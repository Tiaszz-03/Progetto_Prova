import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Search, Filter, Loader2 } from "lucide-react";
import { ShipmentStepStatus } from "../types";
import { fetchInvoices, scanInvoices } from "../services/invoiceApi";
import { invoiceToShipment } from "../invoiceAdapter";
import type { Shipment } from "../types";

const AVAILABLE_DOCUMENTS = [
  "E80 Group, Inc. inv. 1026001432 (1).pdf",
  "Allegato_CAx_20260327172614532 (2).pdf",
  "Allegato_CA_20260327172814503 (1).pdf",
  "FACTURE PROFORMA TOTALE (1).pdf",
];

function toDocumentUrl(fileName: string): string {
  return `/${encodeURI(fileName)}`;
}

async function loadDocumentAsFile(fileName: string): Promise<File> {
  const response = await fetch(toDocumentUrl(fileName));
  if (!response.ok) {
    throw new Error(`Unable to load document "${fileName}" (${response.status})`);
  }
  const blob = await response.blob();
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

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const invoices = await fetchInvoices();
      setShipments(invoices.map(invoiceToShipment));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load invoices");
      setShipments([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const runSelectedScan = async () => {
    if (!selectedDocuments.length) return;
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
                <tr key={shipment.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-bold text-slate-900 group underline decoration-indigo-200 group-hover:decoration-indigo-500 transition-all">
                      {shipment.fileNumber}
                    </div>
                    <div className="text-[11px] font-medium text-slate-500 uppercase mt-0.5">
                      {shipment.shipper}
                    </div>
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
                  <td className="px-6 py-4">
                    {(() => {
                      const done = shipment.steps.filter(
                        (s) => s.status === ShipmentStepStatus.COMPLETED,
                      ).length;
                      const total = shipment.steps.length;
                      const missing = shipment.steps
                        .filter((s) => s.status !== ShipmentStepStatus.COMPLETED)
                        .map((s) => s.name);
                      return (
                        <div>
                          <div className="text-xs font-bold text-slate-900">
                            {done} / {total} Done
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5 truncate max-w-[150px]">
                            {missing.length > 0 ? `Await: ${missing.join(", ")}` : "All complete"}
                          </div>
                        </div>
                      );
                    })()}
                  </td>
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
