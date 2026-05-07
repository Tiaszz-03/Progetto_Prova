from __future__ import annotations

import hashlib
import logging
import re
import threading
from pathlib import Path
from .extraction import InvoiceExtractor
from .models import InvoiceExtracted, RelatedDocument
from .services.entity_resolution import EntityResolver
from .services.extraction_cache import ExtractionCacheService
from .services.normalization import normalize_company_name
from .services.shipment_grouping import ShipmentGroupingConfig, ShipmentGroupingService


class InvoiceRepository:
    def __init__(self, invoices_dir: Path) -> None:
        self.invoices_dir = invoices_dir
        self.extractor = InvoiceExtractor()
        self._cache: dict[str, InvoiceExtracted] = {}
        self._locks_by_hash: dict[str, threading.Lock] = {}
        self._locks_guard = threading.Lock()
        self.cache_service = ExtractionCacheService(invoices_dir / ".cache" / "cache.db")
        self.grouping_service = ShipmentGroupingService(
            invoices_dir / ".cache" / "cache.db",
            ShipmentGroupingConfig(threshold=0.72)
        )
        self.entity_resolver = EntityResolver()
        self.logger = logging.getLogger(__name__)

    def list_ids(self) -> list[str]:
        ids = []
        for pdf in sorted(self.invoices_dir.glob("*.pdf")):
            ids.append(self._build_id(pdf))
        return ids

    def list_invoices(
        self,
        *,
        customer: str | None = None,
        destination_country: str | None = None,
        hs_code: str | None = None,
        min_weight: float | None = None,
        max_weight: float | None = None,
        document_type: str | None = None,
        shipment_status: str | None = None,
        missing_fields: str | None = None,
    ) -> list[InvoiceExtracted]:
        seen_content_hashes: set[str] = set()
        invoices: list[InvoiceExtracted] = []
        for pdf in sorted(self.invoices_dir.glob("*.pdf")):
            content_hash = hashlib.sha1(pdf.read_bytes()).hexdigest()
            if content_hash in seen_content_hashes:
                continue
            seen_content_hashes.add(content_hash)

            invoice_id = self._build_id(pdf)
            invoice = self.get_invoice(invoice_id)
            invoices.append(invoice)

        group_ids = self.grouping_service.assign_group_ids(invoices)
        grouped: dict[str, list[InvoiceExtracted]] = {}
        for invoice in invoices:
            group_key = group_ids.get(invoice.id, f"SHP-{invoice.id}")
            grouped.setdefault(group_key, []).append(invoice)

        out: list[InvoiceExtracted] = []
        for group_key, docs in sorted(grouped.items(), key=lambda kv: kv[0]):
            docs_sorted = sorted(docs, key=lambda inv: inv.file_name.lower())
            primary = self._pick_primary_document(docs_sorted)

            related = [
                RelatedDocument(
                    id=doc.id,
                    file_name=doc.file_name,
                    document_type=doc.document_type,
                    document_number=doc.invoice_number or doc.customer_reference,
                )
                for doc in docs_sorted
                if doc.id != primary.id
            ]

            enriched = self._clone_invoice(primary)
            enriched.shipment_group_id = group_key
            enriched.parent_invoice_id = primary.id
            enriched.related_documents = related
            enriched.shipment_status = "matched"
            self._resolve_entities(enriched)
            out.append(enriched)

        return self._apply_filters(
            sorted(out, key=lambda inv: inv.file_name.lower()),
            customer=customer,
            destination_country=destination_country,
            hs_code=hs_code,
            min_weight=min_weight,
            max_weight=max_weight,
            document_type=document_type,
            shipment_status=shipment_status,
            missing_fields=missing_fields,
        )

    def get_invoice(self, invoice_id: str) -> InvoiceExtracted:
        if invoice_id in self._cache:
            return self._cache[invoice_id]

        pdf = self._resolve_file(invoice_id)
        pdf_bytes = pdf.read_bytes()
        content_hash = self.cache_service.compute_file_hash(pdf_bytes)

        with self._hash_lock(content_hash):
            if self.cache_service.extraction_exists(content_hash):
                self.logger.info("CACHE HIT | file_hash=%s", content_hash)
                cached = self.cache_service.get_cached_extraction(content_hash)
                payload = (cached or {}).get("extraction_payload") or {}
                payload["id"] = invoice_id
                payload["file_name"] = pdf.name
                payload["file_path"] = str(pdf)
                invoice = InvoiceExtracted(**payload)
            else:
                self.logger.info("CACHE MISS | processing extraction... | file_hash=%s", content_hash)
                invoice = self.extractor.extract_from_pdf(invoice_id=invoice_id, pdf_path=pdf)
                payload = invoice.model_dump(mode="json") if hasattr(invoice, "model_dump") else invoice.dict()
                self.cache_service.save_cached_extraction(content_hash, pdf.name, payload)
        self._cache[invoice_id] = invoice
        return invoice

    def get_pdf_path(self, invoice_id: str) -> Path:
        return self._resolve_file(invoice_id)

    def save_uploaded_pdf(self, original_name: str, content: bytes) -> str:
        safe_name = Path(original_name).name or "invoice.pdf"
        if not safe_name.lower().endswith(".pdf"):
            safe_name = f"{safe_name}.pdf"

        # Keep a stable file name: rescans must not create hashed copies.
        target_path = self.invoices_dir / safe_name
        changed = (not target_path.exists()) or target_path.read_bytes() != content
        if changed:
            target_path.write_bytes(content)

        invoice_id = self._build_id(target_path)
        if changed and invoice_id in self._cache:
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
    def _pick_primary_document(docs: list[InvoiceExtracted]) -> InvoiceExtracted:
        def rank(doc: InvoiceExtracted) -> tuple[int, str]:
            order = {
                "commercial_invoice": 0,
                "proforma_invoice": 1,
                "transport_document": 2,
                "packing_list": 3,
                "unknown": 4,
                None: 5,
            }
            return (order.get(doc.document_type, 6), doc.file_name.lower())

        return sorted(docs, key=rank)[0]

    @staticmethod
    def _clone_invoice(invoice: InvoiceExtracted) -> InvoiceExtracted:
        if hasattr(invoice, "model_copy"):
            return invoice.model_copy(deep=True)  # Pydantic v2
        return invoice.copy(deep=True)  # Pydantic v1 fallback

    @staticmethod
    def _linked_document_number(invoice: InvoiceExtracted) -> str:
        # Prefer reference fields first: these often carry DDT/transport numbers.
        candidates = [
            InvoiceRepository._normalize_doc_number(invoice.customer_reference),
            InvoiceRepository._normalize_doc_number(invoice.invoice_number),
        ]
        for candidate in candidates:
            if candidate:
                return candidate
        return ""

    @staticmethod
    def _normalize_doc_number(value: str | None) -> str:
        if not value:
            return ""
        compact = value.strip().upper()
        if not compact:
            return ""

        # Keep alphanumeric token only, remove separators to improve matching
        # between variants like "DDT N. 8123" vs "8123".
        tokens = re.findall(r"[A-Z0-9]+", compact)
        if not tokens:
            return ""
        return "".join(tokens)

    def _hash_lock(self, file_hash: str) -> threading.Lock:
        with self._locks_guard:
            lock = self._locks_by_hash.get(file_hash)
            if lock is None:
                lock = threading.Lock()
                self._locks_by_hash[file_hash] = lock
            return lock

    def _resolve_entities(self, invoice: InvoiceExtracted) -> None:
        invoice.shipper.name = self.entity_resolver.resolve(invoice.shipper.name, invoice.shipper.vat_or_eori)
        invoice.consignee.name = self.entity_resolver.resolve(invoice.consignee.name)
        invoice.delivery_party.name = self.entity_resolver.resolve(invoice.delivery_party.name)
        invoice.bill_to_party.name = self.entity_resolver.resolve(invoice.bill_to_party.name)

    @staticmethod
    def _apply_filters(
        invoices: list[InvoiceExtracted],
        *,
        customer: str | None,
        destination_country: str | None,
        hs_code: str | None,
        min_weight: float | None,
        max_weight: float | None,
        document_type: str | None,
        shipment_status: str | None,
        missing_fields: str | None,
    ) -> list[InvoiceExtracted]:
        out = invoices
        if customer:
            needle = normalize_company_name(customer) or customer.lower()
            out = [
                inv
                for inv in out
                if needle in (normalize_company_name(inv.consignee.name) or "")
                or needle in (normalize_company_name(inv.bill_to_party.name) or "")
            ]
        if destination_country:
            country = destination_country.lower()
            out = [
                inv
                for inv in out
                if country in (inv.delivery_party.address or "").lower()
                or country in (inv.consignee.address or "").lower()
            ]
        if hs_code:
            out = [inv for inv in out if (inv.hs_code or "").startswith(hs_code)]
        if min_weight is not None:
            out = [inv for inv in out if inv.gross_weight_kg is not None and inv.gross_weight_kg >= min_weight]
        if max_weight is not None:
            out = [inv for inv in out if inv.gross_weight_kg is not None and inv.gross_weight_kg <= max_weight]
        if document_type:
            out = [inv for inv in out if inv.document_type == document_type]
        if shipment_status:
            out = [inv for inv in out if inv.shipment_status == shipment_status]
        if missing_fields:
            fields = [f.strip() for f in missing_fields.split(",") if f.strip()]
            out = [inv for inv in out if any(getattr(inv, field, None) in (None, "", []) for field in fields)]
        return out
