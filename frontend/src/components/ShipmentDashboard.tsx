import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ChevronDown, ChevronRight, Filter, Loader2, Search } from "lucide-react";
import { ShipmentStepStatus, type Shipment } from "../types";
import { fetchInvoices, scanInvoices, type InvoiceFilters } from "../services/invoiceApi";
import { invoiceToShipment } from "../invoiceAdapter";

const AVAILABLE_DOCUMENTS = [
  "E80 Group, Inc. inv. 1026001432 (1).pdf",
  "Allegato_CAx_20260327172614532.pdf",
  "Allegato_CA_20260327172814503.pdf",
  "FACTURE PROFORMA TOTALE (1).pdf",
];

function toDocumentUrl(fileName: string): string {
  return `/invoices/${encodeURI(fileName)}`;
}

async function loadDocumentAsFile(fileName: string): Promise<File> {
  const response = await fetch(toDocumentUrl(fileName));
  if (!response.ok) {
    throw new Error(`Unable to load document "${fileName}" (${response.status})`);
  }
  const contentType = response.headers.get("content-type")?.toLowerCase() || "";
  const blob = await response.blob();
  const bytes = new Uint8Array(await blob.slice(0, 5).arrayBuffer());
  const pdfSignature = String.fromCharCode(...bytes);
  const looksLikePdf = pdfSignature === "%PDF-";
  const looksLikeHtml = contentType.includes("text/html");
  if (!looksLikePdf || looksLikeHtml) {
    throw new Error(
      `Document "${fileName}" is not being served as a valid PDF. ` +
        "Check that the file exists in backend/files/invoices and restart frontend dev server.",
    );
  }
  return new File([blob], fileName, { type: "application/pdf" });
}

export function ShipmentDashboard() {
  const [searchTerm, setSearchTerm] = useState("");
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newShipmentOpen, setNewShipmentOpen] = useState(false);
  const [selectedDocuments, setSelectedDocuments] = useState<string[]>([]);
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState<InvoiceFilters>({});
  const inFlightScanKeyRef = useRef<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const invoices = await fetchInvoices(filters);
      setShipments(invoices.map(invoiceToShipment));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load invoices");
      setShipments([]);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    void load();
  }, [load]);

  const runSelectedScan = async () => {
    if (!selectedDocuments.length) return;
    const scanKey = [...selectedDocuments].sort().join("|");
    if (scanning || inFlightScanKeyRef.current === scanKey) {
      return;
    }
    inFlightScanKeyRef.current = scanKey;
    setScanning(true);
    setError(null);
    try {
      const files = await Promise.all(selectedDocuments.map((name) => loadDocumentAsFile(name)));
      await scanInvoices(files);
      await load();
      setNewShipmentOpen(false);
      setSelectedDocuments([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Scan failed");
    } finally {
      setScanning(false);
      inFlightScanKeyRef.current = null;
    }
  };

  const toggleDocumentSelection = (fileName: string) => {
    setSelectedDocuments((prev) =>
      prev.includes(fileName) ? prev.filter((doc) => doc !== fileName) : [...prev, fileName],
    );
  };

  const filtered = shipments.filter((s) => {
    const searchStr =
      `${s.fileNumber} ${s.shipper} ${s.vessel || ""} ${s.origin} ${s.destination} ${s.etd || ""}`.toLowerCase();
    return searchStr.includes(searchTerm.toLowerCase());
  });

  const activeCount = shipments.length;
  const extractedToday = shipments.filter((s) =>
    s.steps.some((st) => st.name === "Client Invoice" && st.status === ShipmentStepStatus.COMPLETED),
  ).length;
  const pending = shipments.filter((s) =>
    s.steps.some((st) => st.status !== ShipmentStepStatus.COMPLETED),
  ).length;

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="space-y-3">
          <h2 className="text-2xl font-bold">Operation Dashboard</h2>
          <p className="text-slate-500 text-sm">Monitor and manage all active shipments.</p>
          <button
            type="button"
            onClick={() => setNewShipmentOpen((current) => !current)}
            className="inline-flex items-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-700"
          >
            + New Shipment
          </button>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Find by Client, Pratica, Vessel, ETD..."
              className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all shadow-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button
            type="button"
            onClick={() => setFiltersOpen((v) => !v)}
            className="p-2 border border-slate-200 rounded-lg bg-white hover:bg-slate-50 transition-colors shadow-sm"
            aria-label="Filter"
          >
            <Filter className="w-5 h-5 text-slate-500" />
          </button>
          {scanning && (
            <span className="flex items-center gap-2 text-sm text-slate-500">
              <Loader2 className="w-4 h-4 animate-spin" />
              Scanning…
            </span>
          )}
        </div>
      </div>
      {filtersOpen && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 shadow-sm">
          <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
            <input className="rounded border border-slate-200 px-3 py-2 text-xs" placeholder="Customer" value={filters.customer ?? ""} onChange={(e) => setFilters((f) => ({ ...f, customer: e.target.value }))} />
            <input className="rounded border border-slate-200 px-3 py-2 text-xs" placeholder="Destination country" value={filters.destination_country ?? ""} onChange={(e) => setFilters((f) => ({ ...f, destination_country: e.target.value }))} />
            <input className="rounded border border-slate-200 px-3 py-2 text-xs" placeholder="HS code" value={filters.hs_code ?? ""} onChange={(e) => setFilters((f) => ({ ...f, hs_code: e.target.value }))} />
            <select className="rounded border border-slate-200 px-3 py-2 text-xs" value={filters.document_type ?? ""} onChange={(e) => setFilters((f) => ({ ...f, document_type: e.target.value || undefined }))}>
              <option value="">All document types</option>
              <option value="commercial_invoice">Commercial Invoice</option>
              <option value="transport_document">Transport Document</option>
              <option value="proforma_invoice">Proforma Invoice</option>
              <option value="packing_list">Packing List</option>
            </select>
          </div>
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={() => void load()} className="rounded bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white">Apply filters</button>
            <button type="button" onClick={() => { setFilters({}); }} className="rounded border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700">Reset</button>
          </div>
        </div>
      )}
      {newShipmentOpen && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Select the documents to scan
          </p>
          <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2">
            {AVAILABLE_DOCUMENTS.map((doc) => (
              <label key={doc} className="flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2">
                <input
                  type="checkbox"
                  checked={selectedDocuments.includes(doc)}
                  onChange={() => toggleDocumentSelection(doc)}
                  className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-xs text-slate-700 break-all">{doc}</span>
              </label>
            ))}
          </div>
          <button
            type="button"
            onClick={() => void runSelectedScan()}
            disabled={scanning || selectedDocuments.length === 0}
            className={`mt-4 rounded-lg px-4 py-2 text-sm font-semibold text-white transition-colors ${
              scanning || selectedDocuments.length === 0
                ? "cursor-not-allowed bg-emerald-300"
                : "bg-emerald-600 hover:bg-emerald-700"
            }`}
          >
            {scanning ? "Scanning with GPT..." : "Start GPT Scan"}
          </button>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-x-auto">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-20 text-slate-500">
            <Loader2 className="w-6 h-6 animate-spin" />
            Loading…
          </div>
        ) : (
          <table className="w-full text-left border-collapse min-w-[1000px]">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-wider text-slate-400">
                  File & Client
                </th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-wider text-slate-400">
                  Route (Origin/Dest)
                </th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-wider text-slate-400">
                  Vessel & ETD
                </th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-wider text-slate-400 text-center">
                  Status
                </th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-wider text-slate-400">
                  Progress
                </th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-wider text-slate-400 text-right">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((shipment) => (
                <Fragment key={shipment.id}>
                <tr className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => setExpandedRows((p) => ({ ...p, [shipment.id]: !p[shipment.id] }))} className="rounded border border-slate-200 p-0.5 text-slate-500">
                        {expandedRows[shipment.id] ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                      </button>
                      <div className="font-bold text-slate-900 group underline decoration-indigo-200 group-hover:decoration-indigo-500 transition-all">
                        {shipment.fileNumber}
                      </div>
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="text-[11px] font-medium uppercase text-slate-500">
                      {shipment.shipper}
                      </span>
                      <DocumentTypeBadge value={shipment.documentType || "unknown"} />
                    </div>
                    <div className="text-[10px] text-slate-400">{shipment.shipmentGroupId || "Ungrouped shipment"}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <span className="text-slate-900">{shipment.origin}</span>
                      <ArrowRight className="w-3 h-3 text-slate-300" />
                      <span className="text-slate-900">{shipment.destination}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {shipment.vessel ? (
                      <>
                        <div className="text-sm font-bold text-slate-700">{shipment.vessel}</div>
                        <div className="text-[10px] text-indigo-600 font-bold uppercase mt-0.5">
                          ETD: {shipment.etd}
                        </div>
                      </>
                    ) : (
                      <div className="text-xs text-slate-400 italic">
                        {shipment.etd ? `Invoice date: ${shipment.etd}` : "Awaiting booking..."}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-center gap-1">
                      {shipment.steps.map((step) => (
                        <div
                          key={step.id}
                          className={`w-2.5 h-2.5 rounded-full ${
                            step.status === ShipmentStepStatus.COMPLETED
                              ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.3)]"
                              : "bg-slate-200"
                          }`}
                          title={step.name}
                        />
                      ))}
                    </div>
                  </td>
                  <td className="px-6 py-4"><WorkflowTimeline shipment={shipment} /></td>
                  <td className="px-6 py-4 text-right">
                    <Link
                      to={`/shipment/${shipment.id}`}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white transition-all shadow-sm"
                      aria-label="Open shipment"
                    >
                      <ArrowRight className="w-4 h-4" />
                    </Link>
                  </td>
                </tr>
                {expandedRows[shipment.id] && (
                  <tr className="bg-slate-50/60">
                    <td colSpan={6} className="px-6 py-3">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Related documents</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {(shipment.relatedDocuments ?? []).length === 0 ? (
                          <span className="text-xs text-slate-400">No linked docs</span>
                        ) : (
                          (shipment.relatedDocuments ?? []).map((doc) => (
                            <span key={doc.id} className="rounded-full border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-700">
                              {doc.documentNumber || doc.fileName} - {doc.documentType || "unknown"}
                            </span>
                          ))
                        )}
                      </div>
                    </td>
                  </tr>
                )}
                </Fragment>
              ))}
            </tbody>
          </table>
        )}
        {!loading && shipments.length === 0 && (
          <div className="py-20 text-center text-slate-400">
            <Search className="w-10 h-10 mx-auto mb-4 opacity-10" />
            <p>No documents have been scanned yet.</p>
            <p className="text-sm mt-2">
              Please select and scan at least one document to see the outcome.
            </p>
          </div>
        )}
        {!loading && shipments.length > 0 && filtered.length === 0 && (
          <div className="py-20 text-center text-slate-400">
            <Search className="w-10 h-10 mx-auto mb-4 opacity-10" />
            <p>No shipments match your filter criteria.</p>
            <p className="text-sm mt-2">Use + New Shipment to scan selected PDF documents.</p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard
          title="Active Shipments"
          value={String(activeCount)}
          sub="From scanned invoices"
          color="indigo"
        />
        <StatCard
          title="Docs extracted"
          value={String(extractedToday)}
          sub="Client invoice step complete"
          color="emerald"
        />
        <StatCard
          title="Pending actions"
          value={String(pending)}
          sub="Steps still open"
          color="orange"
        />
      </div>
    </div>
  );
}

function WorkflowTimeline({ shipment }: { shipment: Shipment }) {
  return (
    <div className="flex flex-wrap gap-1">
      {shipment.steps.map((step) => (
        <span key={step.id} className={`rounded-full px-2 py-0.5 text-[10px] ${step.status === ShipmentStepStatus.COMPLETED ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
          {step.name}
        </span>
      ))}
    </div>
  );
}

function DocumentTypeBadge({ value }: { value: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    commercial_invoice: { label: "Commercial Invoice", cls: "bg-slate-100 text-slate-700 border-slate-200" },
    transport_document: { label: "Transport Document", cls: "bg-blue-50 text-blue-700 border-blue-200" },
    proforma_invoice: { label: "Proforma Invoice", cls: "bg-amber-50 text-amber-700 border-amber-200" },
    packing_list: { label: "Packing List", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    unknown: { label: "Unknown", cls: "bg-slate-100 text-slate-500 border-slate-200" },
  };
  const item = map[value] || map.unknown;
  return <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${item.cls}`}>{item.label}</span>;
}

function StatCard({
  title,
  value,
  sub,
  color,
}: {
  title: string;
  value: string;
  sub: string;
  color: string;
}) {
  const colors: Record<string, string> = {
    indigo: "bg-indigo-50 border-indigo-100 text-indigo-600",
    emerald: "bg-emerald-50 border-emerald-100 text-emerald-600",
    orange: "bg-orange-50 border-orange-100 text-orange-600",
  };

  return (
    <div
      className={`p-6 rounded-xl border ${colors[color] || "bg-slate-50 border-slate-100 text-slate-600"}`}
    >
      <div className="text-xs font-bold uppercase tracking-wider mb-2 opacity-80">{title}</div>
      <div className="text-3xl font-black mb-1">{value}</div>
      <div className="text-xs opacity-70">{sub}</div>
    </div>
  );
}
