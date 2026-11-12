import { formatDocumentFolio } from '@/lib/folio';
import type { KeyboardEvent } from 'react';
import type { Ticket } from '@/actions/tickets';
import type { TicketListCollectPaymentResult } from '@/components/tickets/ticket-list-collect-payment-dialog';
import { TicketPaymentProgressBar } from '@/components/tickets/ticket-payment-progress-bar';
import { TicketRowActions } from '@/components/tickets/ticket-row-actions';
import { formatServiceCurrency } from '@/components/tickets/ticket-services-utils';
import { TripledMobileRecordCard } from '@/components/tripled';
import { formatListDate } from '@/lib/format-list-date';
import { hrefForTicketListRow } from '@/lib/ticket-list-navigation';
import {
  getTicketBalanceDue,
  getTicketPaymentStatus,
  TICKET_PAYMENT_STATUS_ACCENT_CLASS,
  type TicketPaymentStatus,
} from '@/lib/ticket-payment-status';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';

type TicketsMobileCardProps = {
  ticket: Ticket;
  canWrite: boolean;
  onDelete: (id: number) => void;
  onDeleteFailed?: (id: number) => void;
  onPaymentApplied?: (result: TicketListCollectPaymentResult) => void;
  companyId?: number | null;
};

/** How a card names the payment state of a finished ticket (same words as the detail's pill). */
const CARD_STATUS_LABEL: Record<TicketPaymentStatus, string> = {
  paid: 'Pagado',
  partial: 'Pago parcial',
  pending: 'Por cobrar',
};

/** Dot colors: owed money is amber, work still going is slate (ZIG-I36-17). */
const CARD_DOT_CLASS: Record<TicketPaymentStatus | 'working', string> = {
  paid: TICKET_PAYMENT_STATUS_ACCENT_CLASS.paid,
  partial: TICKET_PAYMENT_STATUS_ACCENT_CLASS.partial,
  pending: 'bg-amber-500 dark:bg-amber-400',
  working: TICKET_PAYMENT_STATUS_ACCENT_CLASS.pending,
};

/** «6 materiales» / «1 material», or nothing. */
const materialsLabel = (count: number | undefined): string | null =>
  count && count > 0 ? `${count} ${count === 1 ? 'material' : 'materiales'}` : null;

/**
 * Compact ticket card (ZIG-I13-7): the name in up to two lines with the ticket number,
 * the work done (one line), one meta line `status · date`
 * (no phone on the card, so a tap never dials), a progress bar once something is paid,
 * and Pagado / Saldo that wrap instead of truncating. The whole card opens the
 * ticket; ⋯ keeps Cobrar / Descargar / Eliminar.
 */
export const TicketsMobileCard = ({
  ticket,
  canWrite,
  onDelete,
  onDeleteFailed,
  onPaymentApplied,
  companyId,
}: TicketsMobileCardProps) => {
  const router = useRouter();
  const href = hrefForTicketListRow(ticket, canWrite);
  const status = getTicketPaymentStatus(ticket.total, ticket.paid);
  const paidAmount = ticket.paid ?? 0;
  const balance = getTicketBalanceDue(ticket.total, ticket.paid);
  // An unfinished ticket is En proceso, never Por cobrar (ZIG-I36-17).
  const working = !ticket.finished;
  const statusLabel = working ? 'En proceso' : CARD_STATUS_LABEL[status];
  const materials = materialsLabel(ticket.materials_count);
  const partial = status === 'partial' && !working;
  const dateLabel = formatListDate(ticket.ticket_date);

  const handleNavigate = () => {
    router.push(href);
  };

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      router.push(href);
    }
  };

  return (
    <TripledMobileRecordCard
      interactive
      tabIndex={0}
      role="button"
      className="space-y-1 rounded-xl px-3 py-2.5"
      aria-label={
        ticket.finished
          ? `Ver ticket ${ticket.id.toString()}`
          : canWrite
            ? `Editar ticket ${ticket.id.toString()}`
            : `Ver ticket ${ticket.id.toString()}`
      }
      onClick={handleNavigate}
      onKeyDown={handleKeyDown}
    >
      <div className="flex items-start gap-2">
        <p
          className="line-clamp-2 min-w-0 flex-1 text-[15px] font-semibold leading-snug [overflow-wrap:anywhere]"
          data-testid="ticket-card-name"
        >
          {ticket.client_name || 'Cliente sin nombre'}
        </p>
        <div
          className="-mb-2.5 -mr-1.5 -mt-1 flex shrink-0 items-start gap-0.5"
          onClick={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <span className="pt-1.5 font-mono text-caption tabular-nums text-muted-foreground">
            {formatDocumentFolio(ticket)}
          </span>
          <TicketRowActions
            ticket={ticket}
            onDelete={onDelete}
            onDeleteFailed={onDeleteFailed}
            onPaymentApplied={onPaymentApplied}
            canWrite={canWrite}
            companyId={companyId}
          />
        </div>
      </div>

      {ticket.services_summary ? (
        <p
          className="line-clamp-2 text-sm text-foreground/80"
          data-testid="ticket-card-services"
        >
          {ticket.services_summary}
          {materials ? <span className="text-muted-foreground"> · {materials}</span> : null}
        </p>
      ) : null}

      <p
        className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-caption text-muted-foreground"
        data-testid="ticket-card-meta"
      >
        <span
          className={cn('size-2 shrink-0 rounded-full', CARD_DOT_CLASS[working ? 'working' : status])}
          aria-hidden
        />
        <span>{statusLabel}</span>
        {dateLabel ? (
          <>
            <span aria-hidden>·</span>
            <span>{dateLabel}</span>
          </>
        ) : null}
      </p>

      {partial ? (
        <TicketPaymentProgressBar
          total={ticket.total}
          paid={ticket.paid}
          className="h-1.5 max-w-none"
        />
      ) : null}

      <div
        className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 text-caption tabular-nums"
        data-testid="ticket-payment-summary"
        data-payment-status={status}
      >
        {paidAmount > 0 && balance > 0 && !working ? (
          <>
            <span className="min-w-0 text-muted-foreground [overflow-wrap:anywhere]">
              Pagado {formatServiceCurrency(paidAmount)}
            </span>
            <span className="min-w-0 text-[15px] font-semibold [overflow-wrap:anywhere]">
              Faltan {formatServiceCurrency(balance)}
            </span>
          </>
        ) : working && paidAmount > 0 ? (
          <>
            <span className="min-w-0 text-muted-foreground [overflow-wrap:anywhere]">
              Pagado {formatServiceCurrency(paidAmount)}
            </span>
            <span className="min-w-0 text-[15px] font-semibold [overflow-wrap:anywhere]">
              Total {ticket.total == null ? 'sin definir' : formatServiceCurrency(ticket.total)}
            </span>
          </>
        ) : !working && balance > 0 ? (
          <>
            <span className="min-w-0 text-muted-foreground [overflow-wrap:anywhere]">
              Total {formatServiceCurrency(ticket.total ?? 0)}
            </span>
            <span className="min-w-0 text-[15px] font-semibold [overflow-wrap:anywhere]">
              Faltan {formatServiceCurrency(balance)}
            </span>
          </>
        ) : (
          <>
            <span className="text-muted-foreground">Total</span>
            <span className="min-w-0 text-[15px] font-semibold [overflow-wrap:anywhere]">
              {ticket.total == null ? 'Sin total' : formatServiceCurrency(ticket.total)}
            </span>
          </>
        )}
      </div>
    </TripledMobileRecordCard>
  );
};
