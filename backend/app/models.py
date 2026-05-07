from __future__ import annotations

from datetime import date
from typing import Literal, Optional

from pydantic import BaseModel, Field


class Party(BaseModel):
    name: Optional[str] = None
    address: Optional[str] = None
    vat_or_eori: Optional[str] = None


class RelatedDocument(BaseModel):
    id: str
    file_name: str
    document_type: Optional[
        Literal[
            "commercial_invoice",
            "proforma_invoice",
            "packing_list",
            "transport_document",
            "unknown",
        ]
    ] = None
    document_number: Optional[str] = None


class InvoiceExtracted(BaseModel):
    id: str
    document_type: Optional[
        Literal[
            "commercial_invoice",
            "proforma_invoice",
            "packing_list",
            "transport_document",
            "unknown",
        ]
    ] = None
    shipper: Party
    consignee: Party
    delivery_party: Party = Field(default_factory=Party)
    bill_to_party: Party = Field(default_factory=Party)
    invoice_number: Optional[str] = None
    customer_reference: Optional[str] = None
    invoice_date_raw: Optional[str] = None
    invoice_date: Optional[date] = None
    hs_code: Optional[str] = None
    goods_description: Optional[str] = None
    gross_weight_kg: Optional[float] = Field(default=None, ge=0)
    package_count: Optional[str] = None
    volume: Optional[float] = Field(default=None, ge=0)
    shipment_group_id: Optional[str] = None
    parent_invoice_id: Optional[str] = None
    related_documents: list[RelatedDocument] = Field(default_factory=list)
    field_confidence: dict[str, float] = Field(default_factory=dict)
    extraction_warnings: list[str] = Field(default_factory=list)
    shipment_status: Literal[
        "uploaded",
        "extracted",
        "matched",
        "booking_confirmation",
        "customs_clearance",
        "delivered",
    ] = "matched"
    file_name: str
    file_path: str


class InvoiceListItem(BaseModel):
    id: str
    file_name: str
    invoice_number: Optional[str] = None
    shipper_name: Optional[str] = None
    consignee_name: Optional[str] = None
    invoice_date: Optional[date] = None
    hs_code: Optional[str] = None
    gross_weight_kg: Optional[float] = None
    package_count: Optional[str] = None


class ExtractionJob(BaseModel):
    job_id: str
    status: Literal["queued", "processing", "completed", "failed"]
    invoice_ids: list[str] = Field(default_factory=list)
    error: Optional[str] = None


class ShipmentGroup(BaseModel):
    shipment_group_id: str
    created_at: Optional[str] = None
    customer_name: Optional[str] = None
    origin: Optional[str] = None
    destination: Optional[str] = None
    status: str = "matched"
