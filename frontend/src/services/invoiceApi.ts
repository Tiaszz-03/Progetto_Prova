const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

export type Party = {
  name: string | null;
  address: string | null;
  vat_or_eori?: string | null;
};

export type InvoiceExtracted = {
  id: string;
  shipper: Party;
  consignee: Party;
  invoice_number: string | null;
  customer_reference: string | null;
  invoice_date: string | null;
  hs_code: string | null;
  goods_description: string | null;
  gross_weight_kg: number | null;
  package_count: string | null;
  volume: number | null;
  file_name: string;
  file_path: string;
};

async function parseError(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return "";
  }
}

export async function fetchInvoices(): Promise<InvoiceExtracted[]> {
  const res = await fetch(`${API_BASE}/invoices`);
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
