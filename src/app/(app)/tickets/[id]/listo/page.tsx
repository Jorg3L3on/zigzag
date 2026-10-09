import { notFound } from 'next/navigation';

import { getTicketById } from '@/actions/tickets';
import { TicketCreationReview } from '@/components/tickets/review/ticket-creation-review';
import { requirePagePermission } from '@/lib/page-authz';
import { buildTicketPdfFileName } from '@/lib/ticket-pdf-data';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/** Creation review (ZIG-I2-5): where the Nuevo ticket composer lands after Guardar ticket. */
export default async function TicketReadyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePagePermission('tickets.read');
  const { id } = await params;
  const result = await getTicketById(Number(id));

  if (!result.success || !result.data) {
    notFound();
  }

  const ticket = result.data;
  const lines = ticket.services_tickets.map((line) => ({
    id: Number(line.id),
    serviceId: line.service_id,
    name: line.service?.name ?? 'Servicio',
    quantity: line.quantity,
    price: Number(line.price) || 0,
  }));

  return (
    <TicketCreationReview
      ticketId={String(ticket.id)}
      clientId={ticket.client_id}
      clientName={ticket.client_name}
      clientTel={ticket.client_tel}
      ticketDate={ticket.ticket_date ? new Date(ticket.ticket_date).toISOString() : null}
      total={Number(ticket.total) || 0}
      paid={Number(ticket.paid) || 0}
      finished={ticket.finished}
      lines={lines}
      downloadFileName={buildTicketPdfFileName(ticket)}
    />
  );
}
