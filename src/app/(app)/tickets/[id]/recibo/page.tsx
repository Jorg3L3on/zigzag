import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { getTicketById } from '@/actions/tickets';
import { DocumentPdfViewer } from '@/components/pdf/document-pdf-viewer';
import { ReciboSummary } from '@/components/tickets/review/document-review-parts';
import { formatLongDate } from '@/lib/format-long-date';
import { requirePagePermission } from '@/lib/page-authz';
import { buildReviewLine } from '@/lib/review-lines';
import { isPresupuestoTicket } from '@/lib/ticket-document-kind';
import {
  TICKET_PAYMENT_STATUS_LABEL,
  getTicketPaymentStatus,
} from '@/lib/ticket-payment-status';
import { buildTicketPdfFileName } from '@/lib/ticket-pdf-data';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const generateMetadata = async ({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> => {
  const { id } = await params;
  return { title: `Recibo #${id} · PDF` };
};

/**
 * In-app PDF viewer for a ticket recibo (ZIG-I9-1). Back goes to the creation
 * review when reached from it (?from=listo), otherwise to the ticket detail.
 */
export default async function TicketReciboPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string | string[] }>;
}) {
  await requirePagePermission('tickets.read');
  const { id } = await params;
  const { from } = await searchParams;
  const numericId = Number(id);
  if (!Number.isSafeInteger(numericId) || numericId <= 0) notFound();

  const result = await getTicketById(numericId);
  if (!result.success || !result.data) notFound();

  const ticket = result.data;
  // Quotes have /presupuestos/[id]/pdf; an unfinished ticket has no recibo yet.
  if (isPresupuestoTicket(ticket.document_kind) || !ticket.finished) notFound();

  const ticketId = String(ticket.id);
  const total = Number(ticket.total) || 0;
  const paid = Number(ticket.paid) || 0;
  const lines = ticket.services_tickets.map(buildReviewLine);
  const dateLabel = formatLongDate(
    ticket.ticket_date ? new Date(ticket.ticket_date).toISOString() : null,
  );
  const fromReview = from === 'listo';

  return (
    <DocumentPdfViewer
      ticketId={ticketId}
      kind="recibo"
      title={`Recibo #${ticketId}`}
      subtitle={`Finalizado · ${TICKET_PAYMENT_STATUS_LABEL[getTicketPaymentStatus(total, paid)]}`}
      backHref={fromReview ? `/tickets/${ticketId}/listo` : `/tickets/${ticketId}`}
      backLabel={fromReview ? 'Volver al resumen del ticket' : 'Volver al ticket'}
      downloadFileName={buildTicketPdfFileName(ticket)}
      summary={
        <ReciboSummary
          ticketId={ticketId}
          clientName={ticket.client_name}
          dateLabel={dateLabel}
          lines={lines}
          total={total}
          paid={paid}
        />
      }
      whatsApp={{
        kind: 'recibo',
        phone: ticket.client_tel,
        clientName: ticket.client_name,
        total,
        paid,
      }}
    />
  );
}
