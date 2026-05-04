export enum DocumentType {
  CONFIRMATION_EMAIL = "confirmation_email",
  BOOKING_CONFIRMATION = "booking_confirmation",
  CLIENT_INVOICE = "client_invoice",
  PACKING_LIST = "packing_list",
}

export enum ShipmentStepStatus {
  NOT_STARTED = "not_started",
  COMPLETED = "completed",
}

export interface ShipmentStep {
  id: string;
  name: string;
  status: ShipmentStepStatus;
  completedAt?: string;
  output?: string;
  originalSource?: string; // Link to "email" or "doc"
  extractedData?: any;
}

export interface Shipment {
  id: string;
  fileNumber: string;
  shipper: string;
  origin: string;
  destination: string;
  vessel?: string;
  etd?: string;
  createdAt: string;
  steps: ShipmentStep[];
}

export const INITIAL_STEPS: string[] = [
  "Open the file",
  "Booking Confirmation",
  "Client Invoice",
  "Packing List",
  "Send Instructions"
];
