import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { 
  ArrowLeft, 
  CheckCircle2, 
  Circle, 
  FileText, 
  Mail, 
  Database, 
  Download, 
  Send, 
  Loader2,
  AlertCircle,
  ClipboardList,
  ExternalLink
} from "lucide-react";
import { RAW_DOC_EXAMPLES } from "../constants";
import { Shipment, ShipmentStepStatus, DocumentType } from "../types";
import { extractDataFromDocument } from "../services/geminiService";
import { fetchInvoice, getInvoiceExcelUrl } from "../services/invoiceApi";
import { invoiceToShipment } from "../invoiceAdapter";

export function ShipmentDetails() {
  const { id } = useParams();
  const [shipment, setShipment] = useState<Shipment | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [activeStepId, setActiveStepId] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const inv = await fetchInvoice(id);
        if (!cancelled) setShipment(invoiceToShipment(inv));
      } catch {
        if (!cancelled) setShipment(undefined);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 p-20 text-slate-500">
        <Loader2 className="w-6 h-6 animate-spin" />
        Loading…
      </div>
    );
  }

  if (!shipment) return <div className="p-8">Shipment not found.</div>;

  const handleProcessStep = async (stepId: string) => {
    setProcessingId(stepId);
    
    // Simulate AI extraction based on step
    try {
      let rawText = "";
      let type: DocumentType = DocumentType.CONFIRMATION_EMAIL;
      
      const step = shipment.steps.find(s => s.id === stepId);
      if (!step) return;

      if (step.name.toLowerCase().includes("invoice")) {
        rawText = RAW_DOC_EXAMPLES.invoice;
        type = DocumentType.CLIENT_INVOICE;
      } else if (step.name.toLowerCase().includes("packing")) {
        rawText = RAW_DOC_EXAMPLES.packingList;
        type = DocumentType.PACKING_LIST;
      } else if (step.name.toLowerCase().includes("booking")) {
        rawText = RAW_DOC_EXAMPLES.booking;
        type = DocumentType.BOOKING_CONFIRMATION;
      }

      const extracted = await extractDataFromDocument(rawText, type);
      
      // Update local state
      setShipment(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          steps: prev.steps.map(s => {
            if (s.id === stepId) {
              return {
                ...s,
                status: ShipmentStepStatus.COMPLETED,
                completedAt: new Date().toISOString().split('T')[0],
                extractedData: extracted,
                output: type === DocumentType.CLIENT_INVOICE ? `Consignee: ${extracted.consignee}` : `Processed ${type}`,
                originalSource: type === DocumentType.CLIENT_INVOICE ? "invoice_23771.pdf" : "doc.pdf"
              };
            }
            return s;
          })
        };
      });
    } catch (err) {
      console.error(err);
      alert("AI Processing failed. Check console.");
    } finally {
      setProcessingId(null);
    }
  };

  const handleSendToERP = (stepId: string) => {
    alert("Data inserted successfully in ERP via API!");
  };

  const handleExportReport = () => {
    if (!id) return;
    window.open(getInvoiceExcelUrl(id), "_blank", "noopener,noreferrer");
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-20">
      <Link to="/" className="inline-flex items-center gap-2 text-slate-500 hover:text-slate-900 transition-colors font-medium">
        <ArrowLeft className="w-4 h-4" />
        Back to Shipments
      </Link>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-3xl font-black text-slate-900">{shipment.fileNumber}</h1>
          <div className="flex items-center gap-4 mt-2">
            <span className="px-3 py-1 bg-indigo-50 text-indigo-700 text-xs font-bold rounded-full uppercase">Active Shipment</span>
            <span className="text-sm text-slate-400">Created on {shipment.createdAt}</span>
          </div>
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleExportReport}
            disabled={!id}
            className="px-4 py-2 border border-slate-200 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-slate-50 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download className="w-4 h-4" /> Export Report
          </button>
          <button className="px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-slate-800 transition-all shadow-md">
            Update ERP
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Progress Sidebar */}
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest px-2">Shipment Steps</h3>
          <div className="bg-white rounded-2xl border border-slate-200 p-2 shadow-sm">
            {shipment.steps.map((step, idx) => (
              <button
                key={step.id}
                onClick={() => setActiveStepId(step.id)}
                className={`w-full text-left p-4 rounded-xl transition-all flex items-start gap-4 group ${
                  activeStepId === step.id ? "bg-slate-50 shadow-inner translate-x-1" : "hover:bg-slate-50/50"
                }`}
              >
                <div className="mt-1">
                  {step.status === ShipmentStepStatus.COMPLETED ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                  ) : (
                    <Circle className="w-5 h-5 text-slate-300 group-hover:text-indigo-400 transition-colors" />
                  )}
                </div>
                <div>
                  <div className={`text-sm font-bold ${activeStepId === step.id ? "text-indigo-600" : "text-slate-700"}`}>
                    {step.name}
                  </div>
                  <div className="text-[10px] uppercase font-bold tracking-tight text-slate-400 mt-0.5">
                    {step.status === ShipmentStepStatus.COMPLETED ? `Done on ${step.completedAt}` : "Pending"}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Step Details */}
        <div className="lg:col-span-2">
          <AnimatePresence mode="wait">
            {activeStepId ? (
              <StepContent 
                key={activeStepId}
                shipment={shipment}
                step={shipment.steps.find(s => s.id === activeStepId)!} 
                onProcess={() => handleProcessStep(activeStepId)}
                onERP={() => handleSendToERP(activeStepId)}
                isProcessing={processingId === activeStepId}
              />
            ) : (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="h-full flex flex-col items-center justify-center p-12 bg-white rounded-2xl border border-dashed border-slate-300 text-slate-400 text-center"
              >
                <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-6 border border-slate-100">
                  <ClipboardList className="w-10 h-10 text-slate-200" />
                </div>
                <p className="text-lg font-medium">Select a step to view details and process documents</p>
                <p className="text-sm mt-2">The AI agent is waiting for your instruction</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

function StepContent({ shipment, step, onProcess, onERP, isProcessing }: { shipment: Shipment; step: any; onProcess: () => void; onERP: () => void; isProcessing: boolean; key?: string }) {
  if (step.name === "Send Instructions") {
    return (
        <motion.div 
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white rounded-2xl p-8 border border-slate-200 shadow-xl"
        >
          <div className="flex items-center gap-4 mb-8">
            <div className="w-12 h-12 bg-indigo-600 text-white rounded-xl flex items-center justify-center">
              <Send className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold">Finalize Shipment</h2>
              <p className="text-sm text-slate-500">Send all collected data for Master Bill of Lading</p>
            </div>
          </div>
          
          <div className="space-y-4 mb-8">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-widest border-b pb-2">Ready Data Summary</div>
            <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="p-3 bg-slate-50 rounded-lg"><span className="text-slate-500 block text-[10px] uppercase font-bold">Booking #</span> EBKG16337174</div>
                <div className="p-3 bg-slate-50 rounded-lg"><span className="text-slate-500 block text-[10px] uppercase font-bold">Vessel</span> MSC STACEY</div>
                <div className="p-3 bg-slate-50 rounded-lg"><span className="text-slate-500 block text-[10px] uppercase font-bold">Origin</span> La Spezia, IT</div>
                <div className="p-3 bg-slate-50 rounded-lg"><span className="text-slate-500 block text-[10px] uppercase font-bold">Destination</span> Chicago, US</div>
            </div>
          </div>

          <button 
            onClick={onProcess}
            className="w-full py-4 bg-indigo-600 text-white rounded-xl font-black text-lg hover:bg-slate-900 transition-all flex items-center justify-center gap-3 shadow-lg shadow-indigo-100"
          >
            {isProcessing ? <Loader2 className="w-6 h-6 animate-spin" /> : <><Send className="w-5 h-5" /> SEND MBL INSTRUCTIONS</>}
          </button>
        </motion.div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      className="space-y-6"
    >
      <div className="bg-white rounded-2xl p-8 border border-slate-200 shadow-sm">
        <div className="flex justify-between items-start mb-8">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center">
              {step.name.includes("Invoice") ? <FileText className="w-6 h-6" /> : <Mail className="w-6 h-6" />}
            </div>
            <div>
              <h2 className="text-xl font-bold">{step.name}</h2>
              <p className="text-sm text-slate-500">Document analysis and data extraction</p>
            </div>
          </div>
          <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter ${
            step.status === ShipmentStepStatus.COMPLETED ? "bg-emerald-100 text-emerald-700" : "bg-orange-100 text-orange-700"
          }`}>
            {step.status}
          </div>
        </div>

        {step.status === ShipmentStepStatus.COMPLETED ? (
          <div className="space-y-6">
            <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-xl flex items-center gap-4 text-emerald-800 text-sm font-medium">
              <CheckCircle2 className="w-5 h-5" />
              AI Agent has successfully extracted data from the {step.originalSource === "email" ? "email thread" : "PDF document"}.
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 font-mono text-[11px]">
              <div className="space-y-4 border-r border-slate-100 pr-0 md:pr-6">
                <div className="text-xs font-bold text-slate-400 uppercase tracking-widest font-sans mb-4 flex items-center gap-2">
                  {step.originalSource === "email" ? <Mail className="w-3 h-3" /> : <FileText className="w-3 h-3" />}
                  {step.originalSource === "email" ? "Email Exchange Content" : "PDF Raw Extract"}
                </div>
                <div className={`p-4 rounded-lg leading-relaxed shadow-inner ${
                  step.originalSource === "email" ? "bg-indigo-50/50 text-slate-600 border border-indigo-100" : "bg-slate-50 text-slate-400 border border-slate-100"
                }`}>
                  {step.originalSource === "email" && (
                    <div className="mb-4 pb-4 border-b border-indigo-100/50 not-italic font-sans">
                      <div className="flex justify-between text-[10px] text-indigo-400 uppercase font-black">
                        <span>From: customer@tradefast.eu</span>
                        <span>Date: {step.completedAt || shipment.createdAt}</span>
                      </div>
                      <div className="text-slate-900 font-bold mt-1 tracking-tight">RE: Quote Confirmation - {shipment.fileNumber}</div>
                    </div>
                  )}
                  {step.name === "Open the file" ? RAW_DOC_EXAMPLES.quoteEmail : RAW_DOC_EXAMPLES.invoice}
                </div>
                <a 
                  href={step.originalSource === "email" ? "mailto:customer@tradefast.eu" : "#"}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) => {
                    e.preventDefault();
                    const win = window.open("", "_blank");
                    if (!win) return;

                    const data = step.extractedData || {};
                    let content = "";

                    if (step.originalSource === "email") {
                      content = `
                        <div style="max-width: 600px; margin: 40px auto; font-family: -apple-system, system-ui, sans-serif; background: white; padding: 40px; border: 1px solid #eee; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
                          <div style="border-bottom: 2px solid #f0f0f0; padding-bottom: 20px; margin-bottom: 20px;">
                            <p style="margin:0; color:#888; font-size:12px; font-weight:bold; text-transform:uppercase;">From: customer@tradefast.eu</p>
                            <p style="margin:5px 0 0; color:#888; font-size:12px; font-weight:bold; text-transform:uppercase;">Date: ${step.completedAt || "April 20, 2026"}</p>
                            <h2 style="margin:10px 0 0; color:#1a1a1a;">RE: Quote Confirmation - ${shipment.fileNumber}</h2>
                          </div>
                          <div style="font-size: 14px; line-height: 1.6; color: #333;">
                            <p>Dear Operations Team,</p>
                            <p>We officially <strong>accept</strong> the quote provided for the shipment of goods from <strong>${shipment.origin}</strong> to <strong>${shipment.destination}</strong>.</p>
                            <p>Please proceed with opening the file AE-2026-8123 and finalize the booking as discussed.</p>
                            <div style="background: #f9f9f9; padding: 15px; border-radius: 4px; margin: 20px 0;">
                              <p style="margin:0; font-weight:bold; color:#6366f1;">Extracted Details:</p>
                              <ul style="margin:10px 0 0; padding-left:20px;">
                                <li>Shipper: ${data.shipperName || shipment.shipper}</li>
                                <li>Origin: ${shipment.origin}</li>
                                <li>Destination: ${shipment.destination}</li>
                              </ul>
                            </div>
                            <p>Best regards,<br><strong>Carinzia Mariani</strong><br>Logistics Manager</p>
                          </div>
                        </div>
                      `;
                    } else if (step.name === "Packing List") {
                      content = `
                        <div style="max-width: 850px; margin: 30px auto; font-family: 'Helvetica', 'Arial', sans-serif; background: white; padding: 50px; border: 1px solid #ddd; color: #000;">
                          <div style="display:flex; justify-content:space-between; align-items:start; margin-bottom: 30px;">
                            <div style="background:#000080; color:white; padding:15px 25px; font-weight:900; font-size:32px; font-style:italic;">C.C.M.</div>
                            <div style="text-align:right; font-size:11px;">
                              <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/d/db/CISQ_Logo.png/120px-CISQ_Logo.png" style="height:40px; margin-bottom:5px;" />
                            </div>
                          </div>

                          <h2 style="text-align:center; text-decoration:underline; font-size:18px; margin-bottom:40px;">
                            PACKING LIST for Invoice No. 1012/R dated ${step.completedAt || "11/03/2026"}
                          </h2>

                          <div style="display:grid; grid-template-columns: 140px 1fr; gap:15px; font-size:12px; margin-bottom:40px;">
                            <div style="font-weight:bold;">Manufacturer :</div>
                            <div>
                              <strong>C.C.M. s.r.l.</strong><br/>
                              VIA MONTE GRAPPA 2/4 - 20060 TRUCCAZZANO (MI) - ITALY<br/>
                              TEL. +39 0295367211 Fax +39 0295367201
                            </div>

                            <div style="font-weight:bold;">Consignee:</div>
                            <div>
                               <strong>${data.consignee || shipment.destination}</strong><br/>
                               Attention de : Chef de Service Dédouanement<br/>
                               Email: logistics@consignee.com
                            </div>

                            <div style="font-weight:bold;">Ref:</div>
                            <div>N° 124-25-AOO Relatif à la Fourniture de marchandises pour le dossier <strong>${shipment.fileNumber}</strong></div>
                          </div>

                          <table style="width:100%; border-collapse:collapse; font-size:11px;">
                            <thead>
                              <tr style="border-top:2px solid black; border-bottom:2px solid black;">
                                <th style="text-align:left; padding:10px 0;">Description of goods</th>
                                <th style="text-align:center;">Qty</th>
                                <th style="text-align:center;">Dimensions/mm</th>
                                <th style="text-align:center;">GROSS Weight Kg</th>
                                <th style="text-align:center;">NET Weight Kg</th>
                              </tr>
                            </thead>
                            <tbody>
                              <tr><td colspan="5" style="padding:15px 0; font-weight:bold;">1ER CONTAINER</td></tr>
                               <tr style="border-bottom: 1px solid #f0f0f0;">
                                <td style="padding:10px 0;">
                                  <strong>1 box</strong><br/>
                                  Nos. ${data.descriptionOfGoods || "TEXTILE PRODUCTS"}
                                </td>
                                <td style="text-align:center;">01</td>
                                <td style="text-align:center;">1100 x 3250 x H 1700</td>
                                <td style="text-align:center;">${data.totalWeight || data.weights || "650,00"}</td>
                                <td style="text-align:center;">${data.netWeight || "550,00"}</td>
                              </tr>
                              <tr style="border-bottom: 1px solid #f0f0f0;">
                                <td style="padding:10px 0;"><strong>2 box</strong><br/>Nos. PARTS AND ACCESSORIES</td>
                                <td style="text-align:center;">01</td>
                                <td style="text-align:center;">1100 x 3250 x H 1700</td>
                                <td style="text-align:center;">650,00</td>
                                <td style="text-align:center;">550,00</td>
                              </tr>
                            </tbody>
                          </table>

                          <div style="margin-top:50px; border-top: 2px solid black; padding-top:20px;">
                            <h3 style="font-size:14px; margin-bottom:15px;">TOTALS:</h3>
                            <div style="display:flex; justify-content:space-between; font-size:13px; font-weight:bold;">
                              <span>Colis: ${data.totalPackages || "02"}</span>
                              <span>Poids Brut: ${data.totalWeight || data.weights || "1300,00 Kg"}</span>
                              <span>Poids net: KG ${data.netWeight || "1100,00"}</span>
                              <span>Hs code: ${data.htsCode || "000000"}</span>
                            </div>
                            <div style="margin-top:30px; font-size:12px;">
                              <p>Country of Origin: Italy</p>
                              <p>Truccazzano ${step.completedAt || "12/03/2026"}</p>
                            </div>
                          </div>
                        </div>
                      `;
                    } else {
                      content = `
                        <div style="max-width: 800px; margin: 40px auto; font-family: 'Inter', system-ui, sans-serif; background: white; padding: 60px; border: 1px solid #ccc;">
                          <div style="display:flex; justify-content:space-between; margin-bottom: 60px;">
                            <div>
                              <h1 style="margin:0; font-size: 24px; font-weight: 900; letter-spacing: -1px;">${step.name.toUpperCase()}</h1>
                              <p style="color:#666;">Ref: ${shipment.fileNumber}</p>
                            </div>
                            <div style="text-align:right;">
                              <p style="margin:0; font-weight:bold;">CARVICO SPA</p>
                              <p style="margin:0; font-size:12px; color:#666;">Via A. Pedrinelli n. 96, 24030 Carvico (BG)</p>
                            </div>
                          </div>
                          
                          <div style="margin-bottom: 40px;">
                            <table style="width:100%; border-collapse:collapse;">
                              <tr style="border-bottom: 1px solid #eee;">
                                <td style="padding:15px 0; color:#888; font-size:12px; text-transform:uppercase;">Consignee</td>
                                <td style="padding:15px 0; font-weight:bold;">${data.consignee || data.shipperName || shipment.shipper}</td>
                              </tr>
                               <tr style="border-bottom: 1px solid #eee;">
                                <td style="padding:15px 0; color:#888; font-size:12px; text-transform:uppercase;">Vessel / Voyage</td>
                                <td style="padding:15px 0;">${data.vesselName || shipment.vessel || "N/A"} / ${data.voyageNumber || "N/A"}</td>
                              </tr>
                              <tr style="border-bottom: 1px solid #eee;">
                                <td style="padding:15px 0; color:#888; font-size:12px; text-transform:uppercase;">Origin / Port</td>
                                <td style="padding:15px 0;">${shipment.origin}</td>
                              </tr>
                              <tr style="border-bottom: 1px solid #eee;">
                                <td style="padding:15px 0; color:#888; font-size:12px; text-transform:uppercase;">Destination / Port</td>
                                <td style="padding:15px 0;">${shipment.destination}</td>
                              </tr>
                            </table>
                          </div>

                          <div style="margin-top: 40px;">
                            <h3 style="font-size:14px; text-transform:uppercase; border-bottom: 2px solid black; padding-bottom:10px;">Item Description</h3>
                            <div style="padding: 20px 0;">
                              <p style="margin:0; font-weight:bold;">${data.descriptionOfGoods || "Tessuti sintetici / Naturali"}</p>
                              ${data.htsCode ? `<p style="margin:5px 0; color:#666; font-size:12px;">HTS Code: ${data.htsCode}</p>` : ""}
                            </div>
                            <table style="width:100%; border-top: 1px solid #eee; margin-top:20px;">
                              <tr>
                                <td style="padding:20px 0; color:#888;">Weight</td>
                                <td style="padding:20px 0; text-align:right; font-weight:bold;">${data.weights || data.totalWeight || "1.064,10 MT"}</td>
                              </tr>
                              <tr>
                                <td style="padding:20px 0; color:#888;">Packages</td>
                                <td style="padding:20px 0; text-align:right; font-weight:bold;">${data.palletsNumber || data.totalPackages || "15 PCS"}</td>
                              </tr>
                            </table>
                          </div>

                          <div style="margin-top:100px; padding-top:20px; border-top: 1px solid #eee; font-size:10px; color:#aaa; text-align:center;">
                            This is a generated document for simulation purposes. Original data extracted via FreightAgent AI.
                          </div>
                        </div>
                      `;
                    }

                    win.document.write(`
                      <html>
                        <head><title>${step.name} - Source Preview</title></head>
                        <body style="margin:0; background:#f4f4f5; display:flex; flex-direction:column; min-height:100vh;">
                          <div style="background:#18181b; color:white; padding:15px 40px; display:flex; justify-content:space-between; align-items:center; font-family:sans-serif;">
                            <div><span style="opacity:0.6; font-size:12px;">SOURCE VIEW:</span> <strong style="font-size:14px;">${step.name}</strong></div>
                            <button onclick="window.print()" style="background:#3f3f46; border:none; color:white; padding:6px 12px; border-radius:4px; font-size:12px; font-weight:bold; cursor:pointer;">Print as PDF</button>
                          </div>
                          <div style="flex:1; overflow-y:auto;">${content}</div>
                        </body>
                      </html>
                    `);
                    win.document.close();
                  }}
                  className="w-full py-2 border border-slate-200 rounded-lg font-bold text-slate-600 hover:bg-slate-50 transition-colors flex items-center justify-center gap-2 mt-4 font-sans text-xs"
                >
                  {step.originalSource === "email" ? (
                    <><Mail className="w-3.5 h-3.5" /> Open Email in Mail Client</>
                  ) : (
                    <><ExternalLink className="w-3.5 h-3.5" /> View Original PDF</>
                  )}
                </a>
              </div>

              <div className="space-y-4">
                <div className="text-xs font-bold text-slate-400 uppercase tracking-widest font-sans mb-4 flex items-center gap-2">
                  <Database className="w-3 h-3" />
                  Structured Extraction
                </div>
                <div className="bg-slate-900 text-indigo-300 p-4 rounded-xl overflow-x-auto shadow-xl border border-slate-800">
                  <pre>{JSON.stringify(step.extractedData || {}, null, 2)}</pre>
                </div>
                <button 
                  onClick={onERP}
                  className="w-full py-2 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2 mt-4 font-sans text-xs shadow-md shadow-indigo-100"
                >
                  <Database className="w-3.5 h-3.5" /> Synchronize with ERP
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="py-12 flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-2xl">
            <AlertCircle className="w-12 h-12 text-slate-200 mb-4" />
            <p className="text-slate-500 font-medium mb-6">No data extracted for this step yet.</p>
            <button 
              onClick={onProcess}
              disabled={isProcessing}
              className="px-8 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all flex items-center gap-3 disabled:opacity-50"
            >
              {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : "Run AI Extraction"}
            </button>
            <p className="text-[10px] text-slate-400 mt-4 uppercase font-bold">Awaiting client_invoice.pdf</p>
          </div>
        )}
      </div>
    </motion.div>
  );
}
