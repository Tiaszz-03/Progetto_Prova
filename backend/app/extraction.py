from __future__ import annotations

import json
import os
import re
from datetime import datetime
from pathlib import Path
from typing import Any, Optional

from openai import OpenAI
from pydantic import ValidationError

from .models import InvoiceExtracted, Party


EXTRACTION_SCHEMA = {
    "type": "object",
    "properties": {
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
        "invoice_number": {"type": ["string", "null"]},
        "customer_reference": {"type": ["string", "null"]},
        "invoice_date": {"type": ["string", "null"]},
        "hs_code": {"type": ["string", "null"]},
        "goods_description": {"type": ["string", "null"]},
        "gross_weight_kg": {"type": ["number", "null"]},
        "package_count": {"type": ["string", "null"]},
        "volume": {"type": ["number", "null"]},
        "file_name": {"type": "string"},
    },
    "required": [
        "shipper",
        "consignee",
        "invoice_number",
        "customer_reference",
        "invoice_date",
        "hs_code",
        "goods_description",
        "gross_weight_kg",
        "package_count",
        "volume",
        "file_name",
    ],
    "additionalProperties": False,
}


SYSTEM_PROMPT = """You are an expert system for extracting structured data from commercial invoices, proforma invoices, and customs-related documents.

Your task is to extract key logistics and customs fields from the provided document.

STRICT RULES:
- Return ONLY valid JSON (no explanations, no comments)
- If a field is missing, return null
- DO NOT hallucinate or guess values
- Preserve original text formatting where possible
- Dates must be converted to ISO format: YYYY-MM-DD
- Numbers must be pure numbers (no units, no commas as thousand separators)
- If multiple candidates exist, choose the most relevant for customs/export context

EXTRACTION LOGIC:
- SHIPPER: look for exporter / seller / issued by / company issuing the invoice
- If shipper is expressed as a group/joint venture/groupement, return the full expression, not a partial company short name
- CONSIGNEE: look for delivery to / importer / sold-to party / bill-to party. If value is 'TO ORDER', keep exactly 'TO ORDER'
- INVOICE NUMBER: Invoice No, Invoice Number, Facture No
- CUSTOMER REFERENCE: PO Number, Customer Reference, Order Number
- INVOICE DATE: Date, Issued
- HS CODE: HS, HTS, HS CODE (first/main code)
- GOODS DESCRIPTION: short meaningful summary of goods, ignore technical noise
- GROSS WEIGHT: Gross Weight only (ignore Net Weight, convert grams to kg)
- PACKAGE COUNT: extract only if explicitly labeled as packages/colli/pallets. Never infer from line quantities.
- VOLUME: extract only if explicitly present (CBM, m3). Otherwise null.

EDGE CASES:
- Multiple invoices in one document: extract the main one
- Multiple HS codes: take first
- Missing values: null
- Ignore banking details, payment terms, legal declarations, and totals
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
                                "text": "Extract invoice fields from this PDF document.",
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
            )

            raw_json = response.output_text
            payload = json.loads(raw_json)
            return self._normalize_payload(invoice_id=invoice_id, file_path=pdf_path, payload=payload)
        finally:
            # Best-effort cleanup of uploaded files.
            try:
                self.client.files.delete(uploaded_file.id)
            except Exception:
                pass

    def _normalize_payload(self, invoice_id: str, file_path: Path, payload: dict[str, Any]) -> InvoiceExtracted:
        invoice_date = _safe_iso_date(payload.get("invoice_date"))
        weight = _safe_float(payload.get("gross_weight_kg"))
        volume = _safe_float(payload.get("volume"))

        try:
            return InvoiceExtracted(
                id=invoice_id,
                shipper=Party(**(payload.get("shipper") or {})),
                consignee=Party(**(payload.get("consignee") or {})),
                invoice_number=payload.get("invoice_number"),
                customer_reference=payload.get("customer_reference"),
                invoice_date=invoice_date,
                hs_code=_first_hs_code(payload.get("hs_code")),
                goods_description=payload.get("goods_description"),
                gross_weight_kg=weight,
                package_count=payload.get("package_count"),
                volume=volume,
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


def _safe_iso_date(value: Any):
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, str):
        try:
            return datetime.strptime(value, "%Y-%m-%d").date()
        except ValueError:
            return None
    return None


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


def _display_file_name(saved_name: str) -> str:
    # Remove dedup hash suffix like "_ab8b00e204" or legacy "_2f2ec0ad" before ".pdf".
    return re.sub(r"_[0-9a-f]{8,10}(?=\.pdf$)", "", saved_name, flags=re.IGNORECASE)
