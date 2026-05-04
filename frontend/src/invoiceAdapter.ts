import type { InvoiceExtracted } from "./services/invoiceApi";
import { Shipment, ShipmentStepStatus } from "./types";

export function invoiceToShipment(inv: InvoiceExtracted): Shipment {
  const invDate = inv.invoice_date || "";
  const origin =
    inv.shipper?.address?.split(/[,\n]/)[0]?.trim() || "—";

  return {
    id: inv.id,
    fileNumber:
      inv.invoice_number ||
      inv.file_name.replace(/\.pdf$/i, "") ||
      inv.file_name,
    shipper: inv.shipper?.name || "—",
    origin,
    destination: inv.consignee?.name || "—",
    vessel: undefined,
    etd: invDate || undefined,
    createdAt: invDate || new Date().toISOString().slice(0, 10),
    steps: [
      {
        id: "step-open",
        name: "Open the file",
        status: ShipmentStepStatus.COMPLETED,
        completedAt: invDate || undefined,
        output: `Received: ${inv.file_name}`,
        originalSource: "pdf",
        extractedData: { fileName: inv.file_name },
      },
      {
        id: "step-booking",
        name: "Booking Confirmation",
        status: ShipmentStepStatus.NOT_STARTED,
      },
      {
        id: "step-invoice",
        name: "Client Invoice",
        status: ShipmentStepStatus.COMPLETED,
        completedAt: invDate || undefined,
        output: "Invoice extracted",
        originalSource: "pdf",
        extractedData: {
          consignee: inv.consignee?.name,
          shipperName: inv.shipper?.name,
          htsCode: inv.hs_code,
          descriptionOfGoods: inv.goods_description,
          weights:
            inv.gross_weight_kg != null
              ? String(inv.gross_weight_kg)
              : undefined,
          palletsNumber: inv.package_count ?? undefined,
          invoiceNumber: inv.invoice_number,
          customerReference: inv.customer_reference,
          invoiceDate: inv.invoice_date,
          volume: inv.volume,
          shipperAddress: inv.shipper?.address,
          consigneeAddress: inv.consignee?.address,
          vatOrEori: inv.shipper?.vat_or_eori,
        },
      },
      {
        id: "step-packing",
        name: "Packing List",
        status: ShipmentStepStatus.NOT_STARTED,
      },
      {
        id: "step-send",
        name: "Send Instructions",
        status: ShipmentStepStatus.NOT_STARTED,
      },
    ],
  };
}
