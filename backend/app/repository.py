from __future__ import annotations

import hashlib
from pathlib import Path
from .extraction import InvoiceExtractor
from .models import InvoiceExtracted


class InvoiceRepository:
    def __init__(self, invoices_dir: Path) -> None:
        self.invoices_dir = invoices_dir
        self.extractor = InvoiceExtractor()
        self._cache: dict[str, InvoiceExtracted] = {}

    def list_ids(self) -> list[str]:
        ids = []
        for pdf in sorted(self.invoices_dir.glob("*.pdf")):
            ids.append(self._build_id(pdf))
        return ids

    def list_invoices(self) -> list[InvoiceExtracted]:
        invoices = []
        seen_content_hashes: set[str] = set()
        seen_business_keys: set[str] = set()
        for pdf in sorted(self.invoices_dir.glob("*.pdf")):
            content_hash = hashlib.sha1(pdf.read_bytes()).hexdigest()
            if content_hash in seen_content_hashes:
                continue
            seen_content_hashes.add(content_hash)

            invoice_id = self._build_id(pdf)
            invoice = self.get_invoice(invoice_id)
            business_key = self._business_key(invoice)
            if business_key in seen_business_keys:
                continue
            seen_business_keys.add(business_key)
            invoices.append(invoice)
        return invoices

    def get_invoice(self, invoice_id: str) -> InvoiceExtracted:
        if invoice_id in self._cache:
            return self._cache[invoice_id]

        pdf = self._resolve_file(invoice_id)
        invoice = self.extractor.extract_from_pdf(invoice_id=invoice_id, pdf_path=pdf)
        self._cache[invoice_id] = invoice
        return invoice

    def get_pdf_path(self, invoice_id: str) -> Path:
        return self._resolve_file(invoice_id)

    def save_uploaded_pdf(self, original_name: str, content: bytes) -> str:
        safe_name = Path(original_name).name or "invoice.pdf"
        if not safe_name.lower().endswith(".pdf"):
            safe_name = f"{safe_name}.pdf"

        content_hash = hashlib.sha1(content).hexdigest()[:10]
        target_name = f"{Path(safe_name).stem}_{content_hash}.pdf"
        target_path = self.invoices_dir / target_name
        if not target_path.exists():
            target_path.write_bytes(content)

        invoice_id = self._build_id(target_path)
        if invoice_id in self._cache:
            del self._cache[invoice_id]
        return invoice_id

    def _resolve_file(self, invoice_id: str) -> Path:
        for pdf in self.invoices_dir.glob("*.pdf"):
            if self._build_id(pdf) == invoice_id:
                return pdf
        raise KeyError(f"Invoice {invoice_id} not found")

    @staticmethod
    def _build_id(pdf_path: Path) -> str:
        digest = hashlib.sha1(str(pdf_path.resolve()).encode("utf-8")).hexdigest()
        return digest[:16]

    @staticmethod
    def _business_key(invoice: InvoiceExtracted) -> str:
        invoice_number = (invoice.invoice_number or "").strip().lower()
        consignee = " ".join((invoice.consignee.name or "").lower().split())
        invoice_date = invoice.invoice_date.isoformat() if invoice.invoice_date else ""
        # One invoice row per business document, regardless of retries/renamed files.
        return f"{invoice_number}|{consignee}|{invoice_date}"
