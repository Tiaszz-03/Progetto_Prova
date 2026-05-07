const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "/api";

export type Party = {
  name: string | null;
  address: string | null;
  vat_or_eori?: string | null;
};

export type ExtractedDocumentType =
  | "commercial_invoice"
  | "proforma_invoice"
  | "packing_list"
  | "transport_document"
  | "unknown"
  | null;

export type InvoiceExtracted = {
  id: string;
  document_type: ExtractedDocumentType;
  shipper: Party;
  consignee: Party;
  delivery_party: Party;
  bill_to_party: Party;
  invoice_number: string | null;
  customer_reference: string | null;
  invoice_date_raw?: string | null;
  invoice_date: string | null;
  hs_code: string | null;
  goods_description: string | null;
  gross_weight_kg: number | null;
  package_count: string | null;
  volume: number | null;
  shipment_group_id?: string | null;
  parent_invoice_id?: string | null;
  shipment_status?: string | null;
  field_confidence?: Record<string, number>;
  extraction_warnings?: string[];
  related_documents?: Array<{
    id: string;
    file_name: string;
    document_type: ExtractedDocumentType;
    document_number: string | null;
  }>;
  file_name: string;
  file_path: string;
};

export type InvoiceFilters = {
  customer?: string;
  destination_country?: string;
  hs_code?: string;
  min_weight?: number;
  max_weight?: number;
  document_type?: string;
  shipment_status?: string;
  missing_fields?: string;
};

async function parseError(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return "";
  }
}

export async function fetchInvoices(filters?: InvoiceFilters): Promise<InvoiceExtracted[]> {
  const params = new URLSearchParams();
  if (filters) {
    Object.entries(filters).forEach(([k, v]) => {
      if (v !== undefined && v !== null && String(v).length > 0) params.set(k, String(v));
    });
  }
  const query = params.toString();
  const res = await fetch(`${API_BASE}/invoices${query ? `?${query}` : ""}`);
  if (!res.ok) {
    throw new Error(`Failed to load invoices (${res.status}): ${await parseError(res)}`);
  }
  return res.json();
}

export async function fetchInvoice(id: string): Promise<InvoiceExtracted> {
  const res = await fetch(`${API_BASE}/invoices/${id}`);
  if (!res.ok) {
    throw new Error(`Invoice not found (${res.status})`);
  }
  return res.json();
}

export async function scanInvoices(files: File[]): Promise<InvoiceExtracted[]> {
  if (!files.length) {
    throw new Error("Select at least one PDF.");
  }
  const form = new FormData();
  for (const f of files) {
    form.append("files", f);
  }
  const res = await fetch(`${API_BASE}/invoices/scan`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) {
    throw new Error(`Scan failed (${res.status}): ${await parseError(res)}`);
  }
  return res.json();
}

export function getInvoiceDownloadUrl(id: string): string {
  return `${API_BASE}/invoices/${id}/download`;
}

export function getInvoiceExcelUrl(id: string): string {
  return `${API_BASE}/invoices/${id}/excel`;
}
