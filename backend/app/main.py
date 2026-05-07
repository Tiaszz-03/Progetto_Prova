from __future__ import annotations

from io import BytesIO
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse

from .excel_export import build_invoice_excel
from .models import InvoiceExtracted
from .repository import InvoiceRepository
from .extraction import _display_file_name

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent
FILES_DIR = BASE_DIR / "files"
INVOICES_DIR = FILES_DIR / "invoices"
INVOICES_DIR.mkdir(parents=True, exist_ok=True)

app = FastAPI(title="Customs Invoice Processor", version="1.0.0")
repo = InvoiceRepository(INVOICES_DIR)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/invoices", response_model=list[InvoiceExtracted])
def list_invoices() -> list[InvoiceExtracted]:
    return repo.list_invoices()


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
