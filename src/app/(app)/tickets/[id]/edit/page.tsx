import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';

import { getTicketAuditHistory, getTicketById } from '@/actions/tickets';
import { TicketEditComposer } from '@/components/tickets/composer/ticket-composer';
import { isTicketFullyPaid } from '@/lib/ticket-payment-status';
import { buildTicketEditState } from '@/lib/ticket-edit-state';

export const metadata: Metadata = { title: 'Editar ticket' };
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * Editar ticket (ZIG-I13-6): the one line editor, the same composer a presupuesto
 * uses. /tickets/[id]/services redirects here. A settled ticket cannot be edited.
 */
export default async function EditTicketPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const numericId = Number(id);
  if (!Number.isSafeInteger(numericId) || numericId <= 0) notFound();

  const result = await getTicketById(numericId);
  if (!result.success || !result.data) notFound();
  const ticket = result.data;
  if (isTicketFullyPaid(ticket.total, ticket.paid)) {
    redirect(`/tickets/${String(ticket.id)}`);
  }

  // When the recibo last went out, for the finalized-ticket banner.
  const audit = ticket.finished ? await getTicketAuditHistory(numericId) : null;
  const receiptSharedAt =
    audit?.success && audit.data
      ? (audit.data
          .filter((entry) => entry.eventType === 'receipt_shared')
          .map((entry) => new Date(entry.createdAt))
          .sort((a, b) => b.getTime() - a.getTime())[0]
          ?.toISOString() ?? null)
      : null;

  const state = buildTicketEditState(ticket);
  return (
    <TicketEditComposer
      edit={{
        id: state.id,
        client: state.client,
        ticketDate: state.ticketDate,
        expiresAt: state.expiresAt,
        notes: state.notes,
        lines: state.lines,
        ticket: {
          originalTotal: state.originalTotal,
          paid: state.paid,
          finished: state.finished,
          receiptSharedAt,
        },
      }}
    />
  );
}
