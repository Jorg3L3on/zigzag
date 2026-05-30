import { format } from 'date-fns';
import type {
  Company,
  Service,
  ServicesTicketsRow,
  TicketPaymentRow,
  TicketRow,
} from '@/db/schema';
import { invoiceIssuerFromCompany } from '@/components/pdf/invoice-company';
import {
  getTicketBalanceDue,
  getTicketPaymentStatus,
} from '@/lib/ticket-payment-status';

type TicketServiceLine = ServicesTicketsRow & {
  service: Service | null;
};

export type FintechInvoiceTicket = TicketRow & {
  company: Company | null;
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
    phone: string;
    country: string;
    statusLabel: string;
  };
  ticketNumber: string;
  issueDate: string;
  statusLabel: string;
  balanceLabel: string;
  serviceCountLabel: string;
  items: FintechInvoiceItem[];
  subtotal: number;
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

  const subtotal = items.reduce((sum, item) => sum + item.total, 0);
  const total = isFiniteNumber(ticket.total) ? ticket.total : subtotal;
  const paid = Math.max(isFiniteNumber(ticket.paid) ? ticket.paid : 0, 0);
  const balanceDue = getTicketBalanceDue(total, paid);
  const paymentProgress = total > 0 ? clamp(paid / total, 0, 1) : 0;
  const paymentStatus = getTicketPaymentStatus(total, paid);
  const paymentProgressPercent = Math.round(paymentProgress * 100);

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
      phone: ticket.client_tel?.trim() || 'Sin teléfono',
      country: 'México',
      statusLabel: ticket.client_id ? 'Cuenta activa' : 'Cliente nuevo',
    },
    ticketNumber: formatTicketNumber(ticket.id),
    issueDate: ticket.ticket_date
      ? format(new Date(ticket.ticket_date), 'dd/MM/yyyy')
      : format(new Date(), 'dd/MM/yyyy'),
    statusLabel: paymentStatus === 'paid' ? 'SALDADO' : 'PENDIENTE',
    balanceLabel: balanceDue > 0 ? 'SALDO PENDIENTE' : 'TOTAL DEL TICKET',
    serviceCountLabel:
      items.length === 1
        ? '1 concepto facturado'
        : `${items.length} conceptos facturados`,
    items,
    subtotal,
    total,
    paid,
    balanceDue,
    paymentProgress,
    paymentProgressLabel: `${paymentProgressPercent}% pagado`,
    dueText:
      balanceDue > 0 ? 'Vence al completar el pago' : 'Pago completado',
  };
};
