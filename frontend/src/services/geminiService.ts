import { GoogleGenAI } from "@google/genai";
import { DocumentType } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export async function extractDataFromDocument(text: string, type: DocumentType) {
  const promptMap = {
    [DocumentType.CONFIRMATION_EMAIL]: `
      Extract the following information from this freight quote confirmation email in JSON format:
      - shipperName
      - destinationCountry
      - destinationPort
      - originOfGoods
      Text: ${text}
    `,
    [DocumentType.BOOKING_CONFIRMATION]: `
      Extract the following information from this shipping booking confirmation in JSON format:
      - vesselName
      - voyageNumber
      - shippingLine
      - destinationPort
      - originPort
      - bookingNumber
      Text: ${text}
    `,
    [DocumentType.CLIENT_INVOICE]: `
      Extract the following information from this shipping invoice in JSON format:
      - htsCode
      - descriptionOfGoods
      - weights (total weight)
      - palletsNumber
      - consignee
      - valueOfGoods
      Text: ${text}
    `,
    [DocumentType.PACKING_LIST]: `
      Extract the following information from this packing list in JSON format:
      - containers (list of { number, weight, description })
      - totalWeight
      - totalPackages
      Text: ${text}
    `,
  };

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: promptMap[type] + "\nReturn ONLY valid JSON.",
      config: {
        responseMimeType: "application/json"
      }
    });
    
    const jsonString = response.text.trim();
    return JSON.parse(jsonString);
  } catch (error) {
    console.error("AI Extraction failed:", error);
    throw error;
  }
}
