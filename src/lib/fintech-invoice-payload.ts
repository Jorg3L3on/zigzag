import { format } from 'date-fns';
import type {
  Client,
  Company,
  Service,
  ServicesTicketsRow,
  TicketPaymentRow,
  TicketRow,
} from '@/db/schema';
import { invoiceIssuerFromCompany } from '@/components/pdf/invoice-company';
import { formatClientAddressOneLine } from '@/lib/client-address';
import {
  getTicketBalanceDue,
  getTicketPaymentStatus,
} from '@/lib/ticket-payment-status';
import {
  isPresupuestoTicket,
  normalizeTicketDocumentKind,
} from '@/lib/ticket-document-kind';

type TicketServiceLine = ServicesTicketsRow & {
  service: Service | null;
};

export type FintechInvoiceTicket = TicketRow & {
  company: Company | null;
  client?: Client | null;
  services_tickets: TicketServiceLine[];
  ticket_payments?: TicketPaymentRow[];
};

export type FintechInvoiceItem = {
  number: number;
  name: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
};

export type FintechInvoicePayload = {
  issuer: {
    name: string;
    address: string;
    phone: string;
    email: string;
    footerAddress: string;
    currencyCode: string;
    logoUrl: string | null;
  };
  client: {
    name: string;
    phone: string | null;
    country: string | null;
    address: string | null;
  };
  ticketNumber: string;
  issueDate: string;
  /** Document heading: Recibo vs Presupuesto. */
  documentTitle: string;
  documentKind: 'ticket' | 'presupuesto';
  statusLabel: string;
  balanceLabel: string;
  serviceCountLabel: string;
  items: FintechInvoiceItem[];
  subtotal: number;
  adjustmentAmount: number;
  hasAdjustment: boolean;
  total: number;
  paid: number;
  balanceDue: number;
  paymentProgress: number;
  paymentProgressLabel: string;
  dueText: string;
};

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

export const formatTicketNumber = (id: bigint | number | string): string =>
  String(id).padStart(6, '0');

const roundMoney = (value: number): number => Math.round(value * 100) / 100;

const resolveClientCountry = (ticket: FintechInvoiceTicket): string | null => {
  const fromClient = ticket.client?.country?.trim();
  if (fromClient) return fromClient;
  return null;
};

const resolveClientAddress = (ticket: FintechInvoiceTicket): string | null => {
  if (!ticket.client) return null;
  const formatted = formatClientAddressOneLine(ticket.client, {
    includeCountry: false,
  }).trim();
  return formatted || null;
};

const resolveClientPhone = (ticket: FintechInvoiceTicket): string | null => {
  const fromTicket = ticket.client_tel?.trim();
  if (fromTicket) return fromTicket;
  const fromClient = ticket.client?.phone?.trim();
  if (fromClient) return fromClient;
  return null;
};

export const buildFintechInvoicePayload = (
  ticket: FintechInvoiceTicket,
): FintechInvoicePayload => {
  const issuer = invoiceIssuerFromCompany(ticket.company);
  const currencyCode = issuer.currencyCode || 'MXN';
  const detailAddress = issuer.detailLines.find(Boolean) ?? '';

  const items = ticket.services_tickets
    .filter((line) => !line.deleted_at)
    .map((line, index) => {
      const quantity = isFiniteNumber(line.quantity) ? line.quantity : 0;
      const unitPrice = isFiniteNumber(line.price) ? line.price : 0;
      const serviceName = line.service?.name?.trim() || 'Servicio';
      const description = line.service?.description?.trim() || '';

      return {
        number: index + 1,
        name: serviceName,
        description,
        quantity,
        unitPrice,
        total: quantity * unitPrice,
      };
    });

  const subtotal = roundMoney(items.reduce((sum, item) => sum + item.total, 0));
  const total = roundMoney(
    isFiniteNumber(ticket.total) ? ticket.total : subtotal,
  );
  const adjustmentAmount = roundMoney(total - subtotal);
  const hasAdjustment = Math.abs(adjustmentAmount) >= 0.01;
  const paid = Math.max(isFiniteNumber(ticket.paid) ? ticket.paid : 0, 0);
  const balanceDue = getTicketBalanceDue(total, paid);
  const paymentProgress = total > 0 ? clamp(paid / total, 0, 1) : 0;
  const paymentStatus = getTicketPaymentStatus(total, paid);
  const paymentProgressPercent = Math.round(paymentProgress * 100);
  const documentKind = normalizeTicketDocumentKind(ticket.document_kind);
  const isQuote = isPresupuestoTicket(documentKind);

  return {
    issuer: {
      name: issuer.nameLines.join(' '),
      address: detailAddress,
      phone: issuer.footerPhone || '',
      email: issuer.footerEmail || '',
      footerAddress: issuer.footerAddress || detailAddress,
      currencyCode,
      logoUrl: issuer.logoUrl,
    },
    client: {
      name: ticket.client_name?.trim() || 'Cliente',
      phone: resolveClientPhone(ticket),
      country: resolveClientCountry(ticket),
      address: resolveClientAddress(ticket),
    },
    ticketNumber: formatTicketNumber(ticket.id),
    issueDate: ticket.ticket_date
      ? format(new Date(ticket.ticket_date), 'dd/MM/yyyy')
      : format(new Date(), 'dd/MM/yyyy'),
    documentKind,
    documentTitle: isQuote ? 'Presupuesto' : 'Recibo',
    statusLabel: isQuote
      ? 'PRESUPUESTO'
      : paymentStatus === 'paid'
        ? 'SALDADO'
        : 'PENDIENTE',
    balanceLabel: isQuote
      ? 'TOTAL DEL PRESUPUESTO'
      : balanceDue > 0
        ? 'SALDO PENDIENTE'
        : 'TOTAL DEL TICKET',
    serviceCountLabel:
      items.length === 1
        ? '1 concepto'
        : `${items.length} conceptos`,
    items,
    subtotal,
    adjustmentAmount,
    hasAdjustment,
    total,
    paid: isQuote ? 0 : paid,
    balanceDue: isQuote ? total : balanceDue,
    paymentProgress: isQuote ? 0 : paymentProgress,
    paymentProgressLabel: isQuote
      ? 'Cotización'
      : `${paymentProgressPercent}% pagado`,
    dueText: isQuote
      ? 'Documento informativo — no es un recibo de pago'
      : balanceDue > 0
        ? 'Vence al completar el pago'
        : 'Pago completado',
  };
};
