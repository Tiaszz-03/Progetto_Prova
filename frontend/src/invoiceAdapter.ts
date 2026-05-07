import type { InvoiceExtracted } from "./services/invoiceApi";
import { Shipment, ShipmentStepStatus } from "./types";

function firstAddressLine(value?: string | null): string {
  if (!value) return "";
  return value.split(/[,\n]/)[0]?.trim() || "";
}

export function invoiceToShipment(inv: InvoiceExtracted): Shipment {
  const invDate = inv.invoice_date || "";
  const origin = firstAddressLine(inv.shipper?.address) || inv.shipper?.name || "—";
  const destination =
    firstAddressLine(inv.delivery_party?.address) ||
    inv.delivery_party?.name ||
    firstAddressLine(inv.consignee?.address) ||
    inv.consignee?.name ||
    "—";

  return {
    id: inv.id,
    shipmentGroupId: inv.shipment_group_id ?? undefined,
    documentType: inv.document_type ?? undefined,
    shipmentStatus: inv.shipment_status ?? undefined,
    relatedDocuments: (inv.related_documents ?? []).map((doc) => ({
      id: doc.id,
      fileName: doc.file_name,
      documentType: doc.document_type,
      documentNumber: doc.document_number,
    })),
    fileNumber:
      inv.invoice_number ||
      inv.customer_reference ||
      inv.file_name.replace(/\.pdf$/i, "") ||
      inv.file_name,
    shipper: inv.shipper?.name || "—",
    origin,
    destination,
    vessel: undefined,
    etd: invDate || undefined,
    createdAt: invDate || new Date().toISOString().slice(0, 10),
    steps: [
      {
        id: "step-uploaded",
        name: "Uploaded",
        status: ShipmentStepStatus.COMPLETED,
        completedAt: invDate || undefined,
        output: `Received: ${inv.file_name}`,
        originalSource: "pdf",
        extractedData: { fileName: inv.file_name },
      },
      {
        id: "step-extracted",
        name: "Extracted",
        status: ShipmentStepStatus.COMPLETED,
        completedAt: invDate || undefined,
        output: `${inv.document_type || "unknown"} extracted`,
        originalSource: "pdf",
        extractedData: {
          documentType: inv.document_type,
          consignee: inv.consignee?.name,
          consigneeAddress: inv.consignee?.address,
          deliveryParty: inv.delivery_party?.name,
          deliveryAddress: inv.delivery_party?.address,
          billToParty: inv.bill_to_party?.name,
          billToAddress: inv.bill_to_party?.address,
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
          vatOrEori: inv.shipper?.vat_or_eori,
        },
      },
      {
        id: "step-matched",
        name: "Matched",
        status:
          inv.shipment_group_id || (inv.related_documents?.length ?? 0) > 0
            ? ShipmentStepStatus.COMPLETED
            : ShipmentStepStatus.NOT_STARTED,
      },
      {
        id: "step-booking",
        name: "Booking Confirmation",
        status: ShipmentStepStatus.NOT_STARTED,
      },
      {
        id: "step-customs",
        name: "Customs Clearance",
        status: ShipmentStepStatus.NOT_STARTED,
      },
      {
        id: "step-delivered",
        name: "Delivered",
        status: ShipmentStepStatus.NOT_STARTED,
      },
    ],
  };
}
