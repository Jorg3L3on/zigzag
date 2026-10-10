import type { KeyboardEvent } from 'react';
import type { Ticket } from '@/actions/tickets';
import { ClientPhoneLink } from '@/components/client-phone-link';
import { FormattedCurrency } from '@/components/formatted-currency';
import { FormattedDate } from '@/components/formatted-date';
import type { TicketListCollectPaymentResult } from '@/components/tickets/ticket-list-collect-payment-dialog';
import { TicketPaymentProgressBar } from '@/components/tickets/ticket-payment-progress-bar';
import { TicketRowActions } from '@/components/tickets/ticket-row-actions';
import { TripledMobileRecordCard } from '@/components/tripled';
import { hrefForTicketListRow } from '@/lib/ticket-list-navigation';
import {
  formatTicketListAmount,
  getTicketBalanceDue,
  getTicketPaymentStatus,
  TICKET_PAYMENT_STATUS_ACCENT_CLASS,
  TICKET_PAYMENT_STATUS_LABEL,
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
  const isPaid = status === 'paid';

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
          <div className="flex min-w-0 items-center gap-2">
            <span
              className={cn(
                'size-2 shrink-0 rounded-full',
                TICKET_PAYMENT_STATUS_ACCENT_CLASS[status],
              )}
              aria-hidden
            />
            <span className="truncate text-sm font-medium leading-none text-foreground">
              {TICKET_PAYMENT_STATUS_LABEL[status]}
            </span>
          </div>
        </div>
        <div
          className="flex shrink-0 items-start gap-1"
          onClick={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <span className="rounded-full bg-muted px-2.5 py-1 font-mono text-xs font-semibold tabular-nums text-muted-foreground">
            #{ticket.id.toString()}
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

      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div className="min-w-0 rounded-xl bg-muted/35 p-3">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Teléfono
          </p>
          <dd className="mt-1 truncate font-medium leading-snug">
            <ClientPhoneLink
              phone={ticket.client_tel}
              className="tabular-nums underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              textClassName="tabular-nums"
              onClick={(event) => event.stopPropagation()}
              onKeyDown={(event) => event.stopPropagation()}
            />
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
        {isPaid ? (
          <div
            className="col-span-2 rounded-xl bg-primary/5 p-3"
            data-testid="ticket-payment-summary"
            data-payment-status={status}
          >
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Total
            </p>
            <dd className="mt-1 text-xl font-semibold tabular-nums [overflow-wrap:anywhere]">
              <FormattedCurrency amount={ticket.total} />
            </dd>
          </div>
        ) : (
          <div
            className="col-span-2 flex flex-col gap-2 rounded-xl bg-muted/35 p-3"
            data-testid="ticket-payment-summary"
            data-payment-status={status}
          >
            <TicketPaymentProgressBar
              total={ticket.total}
              paid={ticket.paid}
              className="max-w-none"
            />
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 text-sm tabular-nums">
              <p className="min-w-0 text-muted-foreground [overflow-wrap:anywhere]">
                <span className="font-medium text-foreground">
                  {formatTicketListAmount(ticket.paid ?? 0)}
                </span>
                <span className="font-normal text-muted-foreground/80">
                  {' '}
                  de{' '}
                </span>
                <span>{formatTicketListAmount(ticket.total)}</span>
              </p>
              {ticket.total != null ? (
                <p className="text-muted-foreground [overflow-wrap:anywhere]">
                  Faltan{' '}
                  <span className="font-semibold text-foreground">
                    {formatTicketListAmount(
                      getTicketBalanceDue(ticket.total, ticket.paid),
                    )}
                  </span>
                </p>
              ) : null}
            </div>
          </div>
        )}
      </dl>
    </TripledMobileRecordCard>
  );
};
