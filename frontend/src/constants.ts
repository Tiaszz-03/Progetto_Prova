import { Shipment, ShipmentStepStatus } from "./types";

export const MOCK_SHIPMENTS: Shipment[] = [
  {
    id: "SHP-001",
    fileNumber: "AE-2026-8123",
    shipper: "CARVICO SpA",
    origin: "Bergamo, Italy",
    destination: "Hong Kong, HK",
    vessel: "MSC STACEY",
    etd: "2026-05-15",
    createdAt: "2026-04-20",
    steps: [
      {
        id: "step-1",
        name: "Open the file",
        status: ShipmentStepStatus.COMPLETED,
        completedAt: "2026-04-21",
        output: "File opened: CARVICO SpA",
        originalSource: "email",
        extractedData: {
          shipperName: "CARVICO SpA",
          destinationCountry: "China",
          destinationPort: "Hong Kong",
          originOfGoods: "Italy"
        }
      },
      {
        id: "step-2",
        name: "Booking Confirmation",
        status: ShipmentStepStatus.COMPLETED,
        completedAt: "2026-04-22",
        output: "Vessel: MSC STACEY",
        originalSource: "pdf",
        extractedData: {
          vesselName: "MSC STACEY",
          voyageNumber: "FD614E",
          shippingLine: "MSC",
          destinationPort: "La Spezia",
          bookingNumber: "EBKG16337174"
        }
      },
      { id: "step-3", name: "Client Invoice", status: ShipmentStepStatus.NOT_STARTED },
      { id: "step-4", name: "Packing List", status: ShipmentStepStatus.NOT_STARTED },
      { id: "step-5", name: "Send Instructions", status: ShipmentStepStatus.NOT_STARTED }
    ]
  },
  {
    id: "SHP-002",
    fileNumber: "AE-2026-9055",
    shipper: "FERRERO International",
    origin: "Alba, Italy",
    destination: "New York, USA",
    vessel: "MAERSK ALABAMA",
    etd: "2026-06-02",
    createdAt: "2026-05-01",
    steps: [
      {
        id: "step-1",
        name: "Open the file",
        status: ShipmentStepStatus.COMPLETED,
        completedAt: "2026-05-02",
        output: "File opened: FERRERO",
        originalSource: "email",
        extractedData: { shipperName: "FERRERO", destinationCountry: "USA", destinationPort: "New York", originOfGoods: "Italy" }
      },
      { id: "step-2", name: "Booking Confirmation", status: ShipmentStepStatus.NOT_STARTED },
      { id: "step-3", name: "Client Invoice", status: ShipmentStepStatus.NOT_STARTED },
      { id: "step-4", name: "Packing List", status: ShipmentStepStatus.NOT_STARTED },
      { id: "step-5", name: "Send Instructions", status: ShipmentStepStatus.NOT_STARTED }
    ]
  },
  {
    id: "SHP-003",
    fileNumber: "AE-2026-3312",
    shipper: "ALEXANDER MCQUEEN",
    origin: "London, UK",
    destination: "Tokyo, Japan",
    createdAt: "2026-05-03",
    steps: [
      {
        id: "step-1",
        name: "Open the file",
        status: ShipmentStepStatus.COMPLETED,
        completedAt: "2026-05-04",
        output: "File opened: MCQUEEN",
        originalSource: "email",
        extractedData: { shipperName: "MCQUEEN", destinationCountry: "Japan", destinationPort: "Tokyo", originOfGoods: "UK" }
      },
      { id: "step-2", name: "Booking Confirmation", status: ShipmentStepStatus.NOT_STARTED },
      { id: "step-3", name: "Client Invoice", status: ShipmentStepStatus.NOT_STARTED },
      { id: "step-4", name: "Packing List", status: ShipmentStepStatus.NOT_STARTED },
      { id: "step-5", name: "Send Instructions", status: ShipmentStepStatus.NOT_STARTED }
    ]
  },
  {
    id: "SHP-004",
    fileNumber: "AE-2026-4481",
    shipper: "PRADA SPA",
    origin: "Milan, Italy",
    destination: "Dubai, UAE",
    vessel: "CMA CGM ANTOINE",
    etd: "2026-05-20",
    createdAt: "2026-05-04",
    steps: [
      {
        id: "step-1",
        name: "Open the file",
        status: ShipmentStepStatus.COMPLETED,
        completedAt: "2026-05-04",
        output: "File opened: PRADA",
        originalSource: "email",
        extractedData: { shipperName: "PRADA", destinationCountry: "UAE", destinationPort: "Jebel Ali", originOfGoods: "Italy" }
      },
      {
        id: "step-2",
        name: "Booking Confirmation",
        status: ShipmentStepStatus.COMPLETED,
        completedAt: "2026-05-05",
        output: "Booking Confirmed",
        originalSource: "pdf",
        extractedData: { vesselName: "CMA CGM ANTOINE", voyageNumber: "VR021", bookingNumber: "BKG-9981" }
      },
      { id: "step-3", name: "Client Invoice", status: ShipmentStepStatus.NOT_STARTED },
      { id: "step-4", name: "Packing List", status: ShipmentStepStatus.NOT_STARTED },
      { id: "step-5", name: "Send Instructions", status: ShipmentStepStatus.NOT_STARTED }
    ]
  },
  {
    id: "SHP-005",
    fileNumber: "AE-2026-1122",
    shipper: "BARILLA G. E R. FRATELLI",
    origin: "Parma, Italy",
    destination: "Sydney, Australia",
    createdAt: "2026-05-05",
    steps: [
      {
        id: "step-1",
        name: "Open the file",
        status: ShipmentStepStatus.COMPLETED,
        completedAt: "2026-05-05",
        output: "File opened: BARILLA",
        originalSource: "email",
        extractedData: { shipperName: "BARILLA", destinationCountry: "Australia", destinationPort: "Sydney", originOfGoods: "Italy" }
      },
      { id: "step-2", name: "Booking Confirmation", status: ShipmentStepStatus.NOT_STARTED },
      { id: "step-3", name: "Client Invoice", status: ShipmentStepStatus.NOT_STARTED },
      { id: "step-4", name: "Packing List", status: ShipmentStepStatus.NOT_STARTED },
      { id: "step-5", name: "Send Instructions", status: ShipmentStepStatus.NOT_STARTED }
    ]
  },
  {
    id: "SHP-006",
    fileNumber: "AE-2026-5521",
    shipper: "GUCCI SPA",
    origin: "Florence, Italy",
    destination: "Seoul, Korea",
    vessel: "HYUNDAI LOYALTY",
    etd: "2026-05-10",
    createdAt: "2026-04-15",
    steps: [
      {
        id: "step-1",
        name: "Open the file",
        status: ShipmentStepStatus.COMPLETED,
        completedAt: "2026-04-15",
        output: "File opened: GUCCI",
        originalSource: "email",
        extractedData: { shipperName: "GUCCI", destinationCountry: "Korea", destinationPort: "Busan", originOfGoods: "Italy" }
      },
      {
        id: "step-2",
        name: "Booking Confirmation",
        status: ShipmentStepStatus.COMPLETED,
        completedAt: "2026-04-16",
        output: "Booking Confirmed",
        originalSource: "pdf",
        extractedData: { vesselName: "HYUNDAI LOYALTY", voyageNumber: "HL302", shippingLine: "HMM", bookingNumber: "BKG-7721" }
      },
      {
        id: "step-3",
        name: "Client Invoice",
        status: ShipmentStepStatus.COMPLETED,
        completedAt: "2026-04-18",
        output: "Invoice Extracted",
        originalSource: "pdf",
        extractedData: { consignee: "GUCCI KOREA LTD", htsCode: "4202.21", descriptionOfGoods: "Leather Handbags", weights: "1,250.00 KG", palletsNumber: "8 PLT", valueOfGoods: "125,000.00 EUR" }
      },
      {
        id: "step-4",
        name: "Packing List",
        status: ShipmentStepStatus.COMPLETED,
        completedAt: "2026-04-18",
        output: "Packing List Processed",
        originalSource: "pdf",
        extractedData: { containers: [{ number: "HMMU1234567", weight: "1250", description: "Leather Goods" }], totalWeight: "1250 KG", totalPackages: "240 BOX" }
      },
      {
        id: "step-5",
        name: "Send Instructions",
        status: ShipmentStepStatus.COMPLETED,
        completedAt: "2026-04-19",
        output: "MBL Instructions Sent",
        originalSource: "email"
      }
    ]
  },
  {
    id: "SHP-007",
    fileNumber: "AE-2026-1199",
    shipper: "APPLE INC (Europe)",
    origin: "Dublin, Ireland",
    destination: "Shanghai, China",
    vessel: "OOCL CHENGDU",
    etd: "2026-05-12",
    createdAt: "2026-04-10",
    steps: [
      {
        id: "step-1",
        name: "Open the file",
        status: ShipmentStepStatus.COMPLETED,
        completedAt: "2026-04-10",
        output: "File opened: APPLE",
        originalSource: "email",
        extractedData: { shipperName: "APPLE INC", destinationCountry: "China", destinationPort: "Shanghai", originOfGoods: "Ireland" }
      },
      {
        id: "step-2",
        name: "Booking Confirmation",
        status: ShipmentStepStatus.COMPLETED,
        completedAt: "2026-04-11",
        output: "Booking Confirmed",
        originalSource: "pdf",
        extractedData: { vesselName: "OOCL CHENGDU", voyageNumber: "V112", shippingLine: "OOCL", bookingNumber: "BKG-AP-009" }
      },
      {
        id: "step-3",
        name: "Client Invoice",
        status: ShipmentStepStatus.COMPLETED,
        completedAt: "2026-04-14",
        output: "Invoice Extracted",
        originalSource: "pdf",
        extractedData: { consignee: "APPLE SHANGHAI", htsCode: "8471.30", descriptionOfGoods: "Portable computers", weights: "5,400.00 KG", palletsNumber: "20 PLT", valueOfGoods: "2,450,000.00 USD" }
      },
      {
        id: "step-4",
        name: "Packing List",
        status: ShipmentStepStatus.COMPLETED,
        completedAt: "2026-04-14",
        output: "Packing List Processed",
        originalSource: "pdf",
        extractedData: { containers: [{ number: "MSCU9988776", weight: "5400", description: "Electronics" }], totalWeight: "5400 KG", totalPackages: "1200 UNITS" }
      },
      {
        id: "step-5",
        name: "Send Instructions",
        status: ShipmentStepStatus.COMPLETED,
        completedAt: "2026-04-15",
        output: "MBL Instructions Sent",
        originalSource: "email"
      }
    ]
  }
];

export const RAW_DOC_EXAMPLES = {
  invoice: `FATTURA INVOICE. FOOK WAH KUN KEE KNITTING FACT.LTD. Pg 1. CLIENTE: 6823. DATA: 27/03/26. NR.DOCUMENTO: 23771. Articolo: VITA. Width: 150cm. Team Crimson. Quantity: 71,10 MT. Price: 6,01. Amount: 427,31. Total Amount: 6.395,24 USD. Consignee: YUNFU FLIR GARMENT LIMITED.`,
  packingList: `PACKING LIST. Page 1. CARVICO S.p.A. Documento: 8123. Data: 27/03/26. Cessionario: YUNFU FLIR GARMENT LIMITED. Descrizione: Tessuti sintetici. Quantità: 1.064,10 MT. Peso Lordo: 315,50 KG. Colli: 15.`,
  booking: `SEA WAYBILL No. MEDUWW149217. MSC STACEY - FD614E. Port of Loading: La Spezia. Destination: Chicago, IL. Booking Ref: EBKG16337174.`,
  quoteEmail: `From: customer@tradefast.eu\nTo: ops@freightagent.ai\nSubject: RE: Quote acceptance for shipment to Hong Kong\n\nDear Team,\n\nWe accept the quote provided for the shipment of textiles from Bergamo to Hong Kong. Please proceed with opening the file and booking the next available ship.\n\nShipper: CARVICO SpA\nOrigin: Bergamo, Italy\nDestination: Hong Kong\n\nRegards,\nCarinzia Mariani`
};
