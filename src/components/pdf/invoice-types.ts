import type { InvoiceIssuerData } from '@/components/pdf/invoice-company';

export interface InvoiceItem {
  description: string;
  quantity: string;
  unitPrice: string;
  total: string;
}

export interface InvoiceData {
  /** Company issuing the ticket (from DB). */
  issuer: InvoiceIssuerData;
  clientName: string;
  clientAddress: string;
  clientCity: string;
  clientCountry: string;
  ticketNumber: string;
  issueDate: string;
  dueDate: string;
  items: InvoiceItem[];
  /** Grand total from ticket (rendered directly in the PDF summary). */
  total: string;
  paidAmount?: string;
  poNumber?: string;
  paymentTerms?: string;
  termsAndConditions?: string;
  paymentInformation?: string;
}
