export type InvoiceRow = {
  id: string;
  file_name: string;
  invoice_number: string | null;
  shipper: { name: string | null; address: string | null; vat_or_eori: string | null };
  consignee: { name: string | null; address: string | null; vat_or_eori: string | null };
  invoice_date: string | null;
  hs_code: string | null;
  gross_weight_kg: number | null;
  package_count: string | null;
};

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

export async function fetchInvoices(): Promise<InvoiceRow[]> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/invoices`);
  } catch {
    throw new Error(
      `Impossibile contattare il backend su ${API_BASE}. Verifica che FastAPI sia avviato.`,
    );
  }

  if (!res.ok) {
    let details = "";
    try {
      details = await res.text();
    } catch {
      details = "";
    }
    const suffix = details ? ` - ${details}` : "";
    throw new Error(`Errore caricamento fatture (${res.status})${suffix}`);
  }
  return res.json();
}

export async function scanInvoices(files: File[]): Promise<InvoiceRow[]> {
  if (!files.length) {
    throw new Error("Seleziona almeno un file PDF.");
  }

  const form = new FormData();
  for (const file of files) {
    form.append("files", file);
  }

  let res: Response;
  try {
    res = await fetch(`${API_BASE}/invoices/scan`, {
      method: "POST",
      body: form,
    });
  } catch {
    throw new Error(
      `Impossibile contattare il backend su ${API_BASE}. Verifica che FastAPI sia avviato.`,
    );
  }

  if (!res.ok) {
    let details = "";
    try {
      details = await res.text();
    } catch {
      details = "";
    }
    const suffix = details ? ` - ${details}` : "";
    throw new Error(`Errore scan fatture (${res.status})${suffix}`);
  }

  return res.json();
}

export function getInvoiceDownloadUrl(id: string): string {
  return `${API_BASE}/invoices/${id}/download`;
}

export function getInvoiceExcelUrl(id: string): string {
  return `${API_BASE}/invoices/${id}/excel`;
}
