import type { KeyboardEvent } from 'react';
import type { Ticket } from '@/actions/tickets';
import { FormattedCurrency } from '@/components/formatted-currency';
import { FormattedDate } from '@/components/formatted-date';
import { TicketPaymentBadge } from '@/components/tickets/ticket-payment-badge';
import { TicketRowActions } from '@/components/tickets/ticket-row-actions';
import { TripledMobileRecordCard } from '@/components/tripled';
import { hrefForTicketListRow } from '@/lib/ticket-list-navigation';
import { useRouter } from 'next/navigation';

type TicketsMobileCardProps = {
  ticket: Ticket;
  canWrite: boolean;
  onDelete: (id: number) => void;
};

export const TicketsMobileCard = ({
  ticket,
  canWrite,
  onDelete,
}: TicketsMobileCardProps) => {
  const router = useRouter();
  const href = hrefForTicketListRow(ticket, canWrite);

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
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-2">
          <p className="truncate text-lg font-semibold leading-tight">
            {ticket.client_name || 'Cliente sin nombre'}
          </p>
          <TicketPaymentBadge total={ticket.total} paid={ticket.paid} />
        </div>
        <div
          className="flex shrink-0 items-start gap-1"
          onClick={(event) => event.stopPropagation()}
        >
          <span className="rounded-full bg-muted px-2.5 py-1 font-mono text-xs font-semibold tabular-nums text-muted-foreground">
            #{ticket.id.toString()}
          </span>
          <TicketRowActions
            ticket={ticket}
            onDelete={onDelete}
            canWrite={canWrite}
          />
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div className="min-w-0 rounded-xl bg-muted/35 p-3">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Teléfono
          </p>
          <dd className="mt-1 truncate font-medium tabular-nums leading-snug">
            {ticket.client_tel || '—'}
          </dd>
        </div>
        <div className="min-w-0 rounded-xl bg-muted/35 p-3">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Fecha
          </p>
          <dd className="mt-1 font-medium leading-snug">
            <FormattedDate date={ticket.ticket_date} />
          </dd>
        </div>
        <div className="col-span-2 rounded-xl bg-primary/5 p-3">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Total
          </p>
          <dd className="mt-1 text-xl font-semibold tabular-nums">
            <FormattedCurrency amount={ticket.total} />
          </dd>
        </div>
      </dl>
    </TripledMobileRecordCard>
  );
};
