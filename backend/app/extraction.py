from __future__ import annotations

import json
import logging
import os
import re
from datetime import date, datetime
from pathlib import Path
from typing import Any, Optional

from openai import OpenAI
from pydantic import ValidationError

from .models import InvoiceExtracted, Party
from .services.normalization import (
    normalize_address,
    normalize_company_name,
    normalize_document_number,
    normalize_goods_description,
    normalize_hs_code,
)

logger = logging.getLogger(__name__)


EXTRACTION_SCHEMA = {
    "type": "object",
    "properties": {
        "document_type": {
            "type": ["string", "null"],
            "enum": [
                "commercial_invoice",
                "proforma_invoice",
                "packing_list",
                "transport_document",
                "unknown",
                None,
            ],
        },
        "shipper": {
            "type": "object",
            "properties": {
                "name": {"type": ["string", "null"]},
                "address": {"type": ["string", "null"]},
                "vat_or_eori": {"type": ["string", "null"]},
            },
            "required": ["name", "address", "vat_or_eori"],
            "additionalProperties": False,
        },
        "consignee": {
            "type": "object",
            "properties": {
                "name": {"type": ["string", "null"]},
                "address": {"type": ["string", "null"]},
            },
            "required": ["name", "address"],
            "additionalProperties": False,
        },
        "delivery_party": {
            "type": "object",
            "properties": {
                "name": {"type": ["string", "null"]},
                "address": {"type": ["string", "null"]},
            },
            "required": ["name", "address"],
            "additionalProperties": False,
        },
        "bill_to_party": {
            "type": "object",
            "properties": {
                "name": {"type": ["string", "null"]},
                "address": {"type": ["string", "null"]},
            },
            "required": ["name", "address"],
            "additionalProperties": False,
        },
        "invoice_number": {"type": ["string", "null"]},
        "customer_reference": {"type": ["string", "null"]},
        "invoice_date_raw": {"type": ["string", "null"]},
        "hs_code": {"type": ["string", "null"]},
        "goods_description": {"type": ["string", "null"]},
        "gross_weight_kg": {"type": ["number", "null"]},
        "package_count": {"type": ["string", "null"]},
        "volume": {"type": ["number", "null"]},
    },
    "required": [
        "document_type",
        "shipper",
        "consignee",
        "delivery_party",
        "bill_to_party",
        "invoice_number",
        "customer_reference",
        "invoice_date_raw",
        "hs_code",
        "goods_description",
        "gross_weight_kg",
        "package_count",
        "volume",
    ],
    "additionalProperties": False,
}


SYSTEM_PROMPT = """You are an expert system for extracting structured data from commercial invoices, proforma invoices, and customs-related documents.

Your task is to extract key logistics and customs fields from the provided document.

STRICT RULES:
- Return ONLY valid JSON (no explanations, no comments)
- Never return technical metadata (no file names, file ids, storage keys, upload metadata)
- If a field is missing, return null
- DO NOT hallucinate or guess values
- Preserve original text formatting where possible
- Dates must be copied exactly as shown in the document (raw string). Do NOT convert formats.
- Numbers must be pure numbers (no units, no commas as thousand separators)
- If multiple candidates exist, choose the most relevant for customs/export context
- First classify the document type.
- Then extract fields according to the document type.

DOCUMENT TYPE VALUES:
- commercial_invoice
- proforma_invoice
- packing_list
- transport_document
- unknown

EXTRACTION LOGIC:
- SHIPPER: look for exporter / seller / issued by / company issuing the invoice
- If shipper is expressed as a group/joint venture/groupement, return the full expression, not a partial company short name
- CONSIGNEE: look for importer / recipient / sold-to party. If value is 'TO ORDER', keep exactly 'TO ORDER'
- DELIVERY PARTY: final delivery location or delivery recipient (e.g. "Delivery address", "Ship to", destination warehouse)
- BILL TO PARTY: invoiced customer / bill-to entity when explicitly present
- INVOICE NUMBER: Invoice No, Invoice Number, Facture No, Numero Documento, DDT N.
- CUSTOMER REFERENCE: PO Number, Customer Reference, Order Number, Transport/Delivery reference when present.
- INVOICE DATE RAW: Date, Issued, Data Documento, DDT date as literal document text (e.g. 27/03/26).
- HS CODE: HS, HTS, HS CODE (first/main code)
- GOODS DESCRIPTION: short meaningful summary of goods, ignore technical noise
- GOODS DESCRIPTION RULES:
  - Maximum 8 words
  - Return a concise commercial summary
  - Do not concatenate multiple product lines
  - Avoid legal/commercial wording
- GROSS WEIGHT: Gross Weight only (ignore Net Weight, convert grams to kg)
- PACKAGE COUNT: extract only if explicitly labeled as packages/colli/pallets. Never infer from line quantities.
- VOLUME: extract only if explicitly present (CBM, m3). Otherwise null.

EDGE CASES:
- Multiple invoices in one document: extract the main one
- Multiple HS codes: take first
- Missing values: null
- Ignore banking details, payment terms, legal declarations, and totals
- If both an internal invoice number and a transport document number are present, use:
  - INVOICE NUMBER = main accounting/commercial invoice number
  - CUSTOMER REFERENCE = transport/document linkage number (e.g. Numero Documento, DDT N., Packing List reference)
- For packing_list documents, preserve package/weight details and linkage refs even if invoice totals are absent.
- For transport_document documents, prioritize document/date/reference fields over financial fields.
"""


class InvoiceExtractor:
    def __init__(self, model: str = "gpt-4.1-mini") -> None:
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise RuntimeError("OPENAI_API_KEY is missing. Set it in your environment.")
        self.client = OpenAI(api_key=api_key)
        self.model = model

    def extract_from_pdf(self, invoice_id: str, pdf_path: Path) -> InvoiceExtracted:
        with pdf_path.open("rb") as fp:
            pdf_bytes = fp.read()

        uploaded_file = self.client.files.create(
            file=(pdf_path.name, pdf_bytes, "application/pdf"),
            purpose="assistants",
        )

        try:
            response = self.client.responses.create(
                model=self.model,
                temperature=0,
                input=[
                    {
                        "role": "system",
                        "content": [{"type": "input_text", "text": SYSTEM_PROMPT}],
                    },
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "input_text",
                                "text": "Classify document type first, then extract structured logistics fields from this PDF.",
                            },
                            {
                                "type": "input_file",
                                "file_id": uploaded_file.id,
                            },
                        ],
                    },
                ],
                text={
                    "format": {
                        "type": "json_schema",
                        "name": "invoice_extraction",
                        "schema": EXTRACTION_SCHEMA,
                        "strict": True,
                    }
                },
                metadata={"pipeline": "customs-extraction-v2"},
            )

            raw_json = response.output_text
            logger.info(
                "GPT raw output | invoice_id=%s file=%s model=%s payload=%s",
                invoice_id,
                pdf_path.name,
                self.model,
                raw_json,
            )
            try:
                payload = json.loads(raw_json)
            except json.JSONDecodeError:
                logger.exception(
                    "Failed to decode GPT JSON | invoice_id=%s file=%s model=%s payload=%s",
                    invoice_id,
                    pdf_path.name,
                    self.model,
                    raw_json,
                )
                raise
            logger.info(
                "GPT parsed payload | invoice_id=%s file=%s payload=%s",
                invoice_id,
                pdf_path.name,
                json.dumps(payload, ensure_ascii=False),
            )
            return self._normalize_payload(invoice_id=invoice_id, file_path=pdf_path, payload=payload)
        finally:
            # Best-effort cleanup of uploaded files.
            try:
                self.client.files.delete(uploaded_file.id)
            except Exception:
                pass

    def _normalize_payload(self, invoice_id: str, file_path: Path, payload: dict[str, Any]) -> InvoiceExtracted:
        invoice_date_raw = payload.get("invoice_date_raw")
        invoice_date = _safe_document_date(invoice_date_raw)
        weight = _safe_float(payload.get("gross_weight_kg"))
        volume = _safe_float(payload.get("volume"))
        warnings = _build_warnings(payload, invoice_date)
        confidence = _build_field_confidence(payload, warnings)

        try:
            return InvoiceExtracted(
                id=invoice_id,
                document_type=_safe_document_type(payload.get("document_type")),
                shipper=_normalize_party(payload.get("shipper") or {}),
                consignee=_normalize_party(payload.get("consignee") or {}),
                delivery_party=_normalize_party(payload.get("delivery_party") or {}),
                bill_to_party=_normalize_party(payload.get("bill_to_party") or {}),
                invoice_number=normalize_document_number(payload.get("invoice_number")),
                customer_reference=normalize_document_number(payload.get("customer_reference")),
                invoice_date_raw=invoice_date_raw,
                invoice_date=invoice_date,
                hs_code=normalize_hs_code(_first_hs_code(payload.get("hs_code"))),
                goods_description=normalize_goods_description(payload.get("goods_description")),
                gross_weight_kg=weight,
                package_count=payload.get("package_count"),
                volume=volume,
                field_confidence=confidence,
                extraction_warnings=warnings,
                shipment_status="extracted",
                file_name=_display_file_name(file_path.name),
                file_path=str(file_path),
            )
        except ValidationError as exc:
            raise ValueError(f"Invalid extraction payload for {file_path.name}: {exc}") from exc


def _safe_float(value: Any) -> Optional[float]:
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _safe_document_date(value: Any) -> Optional[date]:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, str):
        raw = value.strip()
        if not raw:
            return None
        # Prefer explicit YYYY-MM-DD/YY-MM-DD and parse common day-first formats.
        patterns: tuple[tuple[str, bool], ...] = (
            ("%Y-%m-%d", False),
            ("%Y/%m/%d", False),
            ("%d/%m/%Y", False),
            ("%d-%m-%Y", False),
            ("%d.%m.%Y", False),
            ("%d/%m/%y", True),
            ("%d-%m-%y", True),
            ("%d.%m.%y", True),
        )
        for fmt, has_two_digit_year in patterns:
            try:
                parsed = datetime.strptime(raw, fmt).date()
                return _normalize_two_digit_year(parsed) if has_two_digit_year else parsed
            except ValueError:
                continue
    return None


def _normalize_two_digit_year(parsed: date) -> date:
    # Clamp all 2-digit parsed years to realistic freight years [2000, 2060].
    if parsed.year < 2000:
        return parsed.replace(year=parsed.year + 100)
    if parsed.year > 2060:
        return parsed.replace(year=parsed.year - 100)
    return parsed


def _first_hs_code(value: Any) -> Optional[str]:
    if value is None:
        return None
    if isinstance(value, str):
        separators = [",", ";", "|", "/"]
        hs = value
        for separator in separators:
            if separator in hs:
                hs = hs.split(separator)[0]
                break
        return hs.strip() or None
    return None


def _safe_document_type(value: Any) -> Optional[str]:
    allowed = {
        "commercial_invoice",
        "proforma_invoice",
        "packing_list",
        "transport_document",
        "unknown",
    }
    if value is None:
        return None
    if isinstance(value, str):
        normalized = value.strip().lower()
        if normalized in allowed:
            return normalized
    return "unknown"


def _normalize_party(payload: dict[str, Any]) -> Party:
    return Party(
        name=normalize_company_name(payload.get("name")),
        address=normalize_address(payload.get("address")),
        vat_or_eori=payload.get("vat_or_eori"),
    )


def _build_warnings(payload: dict[str, Any], parsed_date: Optional[date]) -> list[str]:
    warnings: list[str] = []
    if not payload.get("hs_code"):
        warnings.append("Missing HS code")
    delivery = payload.get("delivery_party") or {}
    if not delivery.get("address"):
        warnings.append("Delivery address incomplete")
    raw_date = (payload.get("invoice_date_raw") or "").strip()
    if raw_date and parsed_date is None:
        warnings.append(f"Suspicious date format: {raw_date}")
    if isinstance(payload.get("invoice_number"), str) and "/" in payload["invoice_number"]:
        warnings.append("Multiple invoice candidates found")
    return warnings


def _build_field_confidence(payload: dict[str, Any], warnings: list[str]) -> dict[str, float]:
    base = 0.92
    penalty = min(0.35, 0.07 * len(warnings))
    conf = max(0.4, base - penalty)
    out = {
        "document_type": conf,
        "invoice_number": conf,
        "customer_reference": conf,
        "invoice_date_raw": conf if payload.get("invoice_date_raw") else 0.5,
        "goods_description": conf if payload.get("goods_description") else 0.45,
        "hs_code": conf if payload.get("hs_code") else 0.35,
    }
    return out


def _display_file_name(saved_name: str) -> str:
    # Remove dedup hash suffix like "_ab8b00e204" or legacy "_2f2ec0ad" before ".pdf".
    return re.sub(r"_[0-9a-f]{8,10}(?=\.pdf$)", "", saved_name, flags=re.IGNORECASE)
