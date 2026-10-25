import { format } from 'date-fns';
import type { InvoiceData } from '@/components/pdf/invoice-types';
import { companyDay } from '@/lib/company-day';
import { invoiceIssuerFromCompany } from '@/components/pdf/invoice-company';
import type { TicketDetailData } from '@/actions/tickets';
import { formatDocumentFolio } from '@/lib/folio';
import { formatReceiptFolioFor } from '@/lib/receipt-pdf/payload';
import {
  getServiceLineDescription,
  getServiceLineName,
} from '@/lib/service-line-display';
import { isPresupuestoTicket } from '@/lib/ticket-document-kind';

/** Builds PDF payload for `InvoiceTemplate` from a ticket loaded with company + services. */
export const buildInvoiceDataFromTicketDetail = (
  ticket: TicketDetailData,
): InvoiceData => {
  const issueDate = format(
    companyDay(ticket.ticket_date ? new Date(ticket.ticket_date) : new Date()).date,
    'dd/MM/yyyy',
  );

  const paidAmount =
    typeof ticket.paid === 'number' && Number.isFinite(ticket.paid)
      ? Math.max(ticket.paid, 0)
      : 0;

  const items = ticket.services_tickets.map((st) => ({
    description: `${getServiceLineName(st)}|||${getServiceLineDescription(st)}`,
    quantity: String(st.quantity),
    unitPrice: st.price.toFixed(2),
    total: (st.quantity * st.price).toFixed(2),
  }));

  const sumFromLines = items.reduce(
    (acc, row) => acc + Number.parseFloat(row.total),
    0,
  );

  const totalStr =
    typeof ticket.total === 'number' && Number.isFinite(ticket.total)
      ? ticket.total.toFixed(2)
      : sumFromLines.toFixed(2);

  return {
    issuer: invoiceIssuerFromCompany(ticket.company),
    clientName: ticket.client_name ?? '',
    clientAddress: ticket.client_tel ?? '',
    clientCity: '',
    clientCountry: 'México',
    ticketNumber: formatReceiptFolioFor(ticket),
    issueDate,
    dueDate: format(companyDay(new Date()).date, 'dd/MM/yyyy'),
    items,
    total: totalStr,
    paidAmount: paidAmount.toFixed(2),
  };
};

const fileFolio = (ticket: Parameters<typeof formatDocumentFolio>[0] & { id: bigint | number | string }): string =>
  ticket.folio_number != null ? formatDocumentFolio(ticket) : String(ticket.id);

export const buildTicketPdfFileName = (
  ticket: Pick<TicketDetailData, 'id' | 'client_name' | 'ticket_date'> & {
    document_kind?: string | null;
    folio_number?: number | null;
    folio_prefix?: string | null;
  },
): string => {
  const safeName = (ticket.client_name ?? 'ticket').replace(/[^\w\s\-]/g, '').trim() || 'ticket';
  const datePart = companyDay(
    ticket.ticket_date ? new Date(ticket.ticket_date) : new Date(),
  ).iso;
  // Quotes download as presupuesto_<cliente>_<fecha>_<id>.pdf (ZIG-I5-4).
  const prefix = isPresupuestoTicket(ticket.document_kind) ? 'presupuesto_' : '';

  return `${prefix}${safeName}_${datePart}_${fileFolio(ticket)}.pdf`;
};
