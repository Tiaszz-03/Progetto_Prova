from __future__ import annotations

from io import BytesIO
import logging
from pathlib import Path
from uuid import uuid4

from dotenv import load_dotenv
from fastapi import BackgroundTasks, FastAPI, File, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse

from .excel_export import build_invoice_excel
from .models import ExtractionJob, InvoiceExtracted
from .repository import InvoiceRepository
from .extraction import _display_file_name

load_dotenv()
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")

BASE_DIR = Path(__file__).resolve().parent.parent
FILES_DIR = BASE_DIR / "files"
INVOICES_DIR = FILES_DIR / "invoices"
INVOICES_DIR.mkdir(parents=True, exist_ok=True)

app = FastAPI(title="Customs Invoice Processor", version="1.0.0")
repo = InvoiceRepository(INVOICES_DIR)
jobs: dict[str, ExtractionJob] = {}

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _is_pdf_bytes(content: bytes) -> bool:
    # PDF magic number: "%PDF-"
    return len(content) >= 5 and content[:5] == b"%PDF-"


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/invoices", response_model=list[InvoiceExtracted])
def list_invoices(
    customer: str | None = Query(default=None),
    destination_country: str | None = Query(default=None),
    hs_code: str | None = Query(default=None),
    min_weight: float | None = Query(default=None),
    max_weight: float | None = Query(default=None),
    document_type: str | None = Query(default=None),
    shipment_status: str | None = Query(default=None),
    missing_fields: str | None = Query(default=None),
) -> list[InvoiceExtracted]:
    return repo.list_invoices(
        customer=customer,
        destination_country=destination_country,
        hs_code=hs_code,
        min_weight=min_weight,
        max_weight=max_weight,
        document_type=document_type,
        shipment_status=shipment_status,
        missing_fields=missing_fields,
    )


@app.get("/invoices/{invoice_id}", response_model=InvoiceExtracted)
def get_invoice(invoice_id: str) -> InvoiceExtracted:
    try:
        return repo.get_invoice(invoice_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Invoice not found") from exc


@app.post("/invoices/scan", response_model=list[InvoiceExtracted])
async def scan_invoices(files: list[UploadFile] = File(...)) -> list[InvoiceExtracted]:
    if not files:
        raise HTTPException(status_code=400, detail="No files provided")

    out: list[InvoiceExtracted] = []
    for file in files:
        filename = file.filename or "invoice.pdf"
        if not filename.lower().endswith(".pdf"):
            continue

        content = await file.read()
        if not content:
            continue
        if not _is_pdf_bytes(content):
            raise HTTPException(
                status_code=400,
                detail=(
                    f'Invalid PDF content for "{filename}". '
                    "The uploaded file is not a real PDF (likely HTML/text fallback)."
                ),
            )

        invoice_id = repo.save_uploaded_pdf(filename, content)
        try:
            out.append(repo.get_invoice(invoice_id))
        except Exception as exc:
            raise HTTPException(
                status_code=500,
                detail=f"Extraction failed for {filename}: {exc}",
            ) from exc

    if not out:
        raise HTTPException(status_code=400, detail="No valid PDF files found")
    return out


def _process_async_job(job_id: str, files_payload: list[tuple[str, bytes]]) -> None:
    job = jobs[job_id]
    job.status = "processing"
    try:
        for filename, content in files_payload:
            invoice_id = repo.save_uploaded_pdf(filename, content)
            repo.get_invoice(invoice_id)
            job.invoice_ids.append(invoice_id)
        job.status = "completed"
    except Exception as exc:
        job.status = "failed"
        job.error = str(exc)


@app.post("/invoices/scan/async", response_model=ExtractionJob)
async def scan_invoices_async(
    background_tasks: BackgroundTasks,
    files: list[UploadFile] = File(...),
) -> ExtractionJob:
    if not files:
        raise HTTPException(status_code=400, detail="No files provided")
    payload: list[tuple[str, bytes]] = []
    for file in files:
        filename = file.filename or "invoice.pdf"
        content = await file.read()
        if not content or not _is_pdf_bytes(content):
            continue
        payload.append((filename, content))
    if not payload:
        raise HTTPException(status_code=400, detail="No valid PDF files found")
    job_id = uuid4().hex
    job = ExtractionJob(job_id=job_id, status="queued")
    jobs[job_id] = job
    background_tasks.add_task(_process_async_job, job_id, payload)
    return job


@app.get("/invoices/scan/status/{job_id}", response_model=ExtractionJob)
def get_scan_job_status(job_id: str) -> ExtractionJob:
    job = jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


@app.get("/invoices/{invoice_id}/download")
def download_invoice(invoice_id: str):
    try:
        pdf_path = repo.get_pdf_path(invoice_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Invoice not found") from exc

    return FileResponse(
        path=pdf_path,
        media_type="application/pdf",
        filename=_display_file_name(pdf_path.name),
    )


@app.get("/invoices/{invoice_id}/excel")
def export_invoice_excel(invoice_id: str):
    try:
        inv = repo.get_invoice(invoice_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Invoice not found") from exc

    content = build_invoice_excel(inv)
    stream = BytesIO(content)
    filename = f"{Path(inv.file_name).stem or inv.id}.xlsx"
    headers = {"Content-Disposition": f'attachment; filename="{filename}"'}

    return StreamingResponse(
        stream,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers=headers,
    )
