const DOCUMENT_NAMES = [
  "E80 Group, Inc. inv. 1026001432 (1).pdf",
  "Allegato_CAx_20260327172614532 (2).pdf",
  "Allegato_CA_20260327172814503 (1).pdf",
  "FACTURE PROFORMA TOTALE (1).pdf",
];

function toDocumentUrl(fileName: string): string {
  return `/${encodeURI(fileName)}`;
}

export function DocumentsPage() {
  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Documents</h2>
        <p className="text-sm text-slate-500">Open the source PDF files available for shipment scan.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {DOCUMENT_NAMES.map((name) => (
          <article key={name} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold text-slate-900 break-words">{name}</p>
            <a
              href={toDocumentUrl(name)}
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-flex items-center rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-indigo-700"
            >
              Open PDF
            </a>
          </article>
        ))}
      </div>
    </section>
  );
}
