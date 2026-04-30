from __future__ import annotations

from datetime import date
from typing import Optional

from pydantic import BaseModel, Field


class Party(BaseModel):
    name: Optional[str] = None
    address: Optional[str] = None
    vat_or_eori: Optional[str] = None


class InvoiceExtracted(BaseModel):
    id: str
    shipper: Party
    consignee: Party
    invoice_number: Optional[str] = None
    customer_reference: Optional[str] = None
    invoice_date: Optional[date] = None
    hs_code: Optional[str] = None
    goods_description: Optional[str] = None
    gross_weight_kg: Optional[float] = Field(default=None, ge=0)
    package_count: Optional[str] = None
    volume: Optional[float] = Field(default=None, ge=0)
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
