from __future__ import annotations

from io import BytesIO

from openpyxl import Workbook
from openpyxl.styles import Font

from .models import InvoiceExtracted


EXCEL_COLUMNS = [
    "File Name",
    "Invoice Number",
    "Customer Reference",
    "Invoice Date",
    "Shipper Name",
    "Consignee Name",
    "HS Code",
    "Goods Description",
    "Gross Weight (kg)",
    "Package Count",
    "Volume",
]


def build_invoice_excel(invoice: InvoiceExtracted) -> bytes:
    workbook = Workbook()
    sheet = workbook.active
    sheet.title = "Invoice"

    sheet.append(EXCEL_COLUMNS)
    sheet.append(
        [
            invoice.file_name,
            invoice.invoice_number,
            invoice.customer_reference,
            invoice.invoice_date.isoformat() if invoice.invoice_date else None,
            invoice.shipper.name,
            invoice.consignee.name,
            invoice.hs_code,
            invoice.goods_description,
            invoice.gross_weight_kg,
            invoice.package_count,
            invoice.volume,
        ]
    )

    for cell in sheet[1]:
        cell.font = Font(bold=True)

    for col in sheet.columns:
        max_len = max(len(str(c.value)) if c.value is not None else 0 for c in col)
        sheet.column_dimensions[col[0].column_letter].width = min(max(max_len + 2, 14), 48)

    out = BytesIO()
    workbook.save(out)
    return out.getvalue()
