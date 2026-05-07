from __future__ import annotations

from io import BytesIO
import logging
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from firebase_functions import https_fn
from flask import Request, Response, jsonify, make_response, send_file

from app.excel_export import build_invoice_excel
from app.extraction import _display_file_name
from app.repository import InvoiceRepository

load_dotenv()
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")

INVOICES_DIR = Path("/tmp/invoices")
INVOICES_DIR.mkdir(parents=True, exist_ok=True)
repo = InvoiceRepository(INVOICES_DIR)


def _is_pdf_bytes(content: bytes) -> bool:
    # PDF magic number: "%PDF-"
    return len(content) >= 5 and content[:5] == b"%PDF-"


def _invoice_to_dict(invoice: Any) -> dict[str, Any]:
    if hasattr(invoice, "model_dump"):
        return invoice.model_dump(mode="json")
    return invoice.dict()


def _json_response(payload: Any, status_code: int = 200) -> Response:
    return make_response(jsonify(payload), status_code)


def _handle_request(req: Request) -> Response:
    path = req.path or "/"
    if path == "/api":
        path = "/"
    elif path.startswith("/api/"):
        path = path[4:] or "/"
    method = req.method.upper()

    if path == "/health" and method == "GET":
        return _json_response({"status": "ok"})

    if path == "/invoices" and method == "GET":
        invoices = [_invoice_to_dict(inv) for inv in repo.list_invoices()]
        return _json_response(invoices)

    if path == "/invoices/scan" and method == "POST":
        files = req.files.getlist("files")
        if not files:
            return _json_response({"detail": "No files provided"}, 400)

        out = []
        for file in files:
            filename = file.filename or "invoice.pdf"
            if not filename.lower().endswith(".pdf"):
                continue
            content = file.read()
            if not content:
                continue
            if not _is_pdf_bytes(content):
                return _json_response(
                    {
                        "detail": (
                            f'Invalid PDF content for "{filename}". '
                            "The uploaded file is not a real PDF (likely HTML/text fallback)."
                        )
                    },
                    400,
                )
            invoice_id = repo.save_uploaded_pdf(filename, content)
            try:
                out.append(_invoice_to_dict(repo.get_invoice(invoice_id)))
            except Exception as exc:
                return _json_response(
                    {"detail": f"Extraction failed for {filename}: {exc}"},
                    500,
                )

        if not out:
            return _json_response({"detail": "No valid PDF files found"}, 400)
        return _json_response(out)

    if method == "GET":
        parts = [p for p in path.strip("/").split("/") if p]
        if len(parts) == 2 and parts[0] == "invoices":
            invoice_id = parts[1]
            try:
                return _json_response(_invoice_to_dict(repo.get_invoice(invoice_id)))
            except KeyError:
                return _json_response({"detail": "Invoice not found"}, 404)

        if len(parts) == 3 and parts[0] == "invoices" and parts[2] == "download":
            invoice_id = parts[1]
            try:
                pdf_path = repo.get_pdf_path(invoice_id)
            except KeyError:
                return _json_response({"detail": "Invoice not found"}, 404)
            return send_file(
                pdf_path,
                mimetype="application/pdf",
                as_attachment=True,
                download_name=_display_file_name(pdf_path.name),
            )

        if len(parts) == 3 and parts[0] == "invoices" and parts[2] == "excel":
            invoice_id = parts[1]
            try:
                inv = repo.get_invoice(invoice_id)
            except KeyError:
                return _json_response({"detail": "Invoice not found"}, 404)

            content = build_invoice_excel(inv)
            stream = BytesIO(content)
            filename = f"{Path(inv.file_name).stem or inv.id}.xlsx"
            return send_file(
                stream,
                mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                as_attachment=True,
                download_name=filename,
            )

    return _json_response({"detail": f"Route not found: {method} {path}"}, 404)


@https_fn.on_request(region="europe-west1")
def api(req: Request) -> Response:
    if req.method.upper() == "OPTIONS":
        response = Response(status=204)
    else:
        response = _handle_request(req)

    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "GET,POST,OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type,Authorization"
    return response
