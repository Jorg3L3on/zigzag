import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { FormattedCurrency } from '@/components/formatted-currency';
import { FormattedDate } from '@/components/formatted-date';
import { TicketPaymentBadge } from '@/components/tickets/ticket-payment-badge';
import {
  getTicketBalanceDue,
} from '@/lib/ticket-payment-status';
import { cn } from '@/lib/utils';

type TicketDetailHeaderProps = {
  ticketId: number | bigint;
  clientName: string | null;
  clientId: number | null;
  finished: boolean;
  total: number | null;
  paid: number | null;
  ticketDate: Date | null;
  createdAt: Date;
  updatedAt: Date | null;
  creatorName: string | null;
  className?: string;
};

export const TicketDetailHeader = ({
  ticketId,
  clientName,
  clientId,
  finished,
  total,
  paid,
  ticketDate,
  createdAt,
  updatedAt,
  creatorName,
  className,
}: TicketDetailHeaderProps) => {
  const balanceDue = getTicketBalanceDue(total, paid);
  const idLabel = String(ticketId);

  return (
    <header
      className={cn(
        'flex flex-col gap-4 border-b border-border/40 pb-5 sm:gap-5',
        className,
      )}
    >
      <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-start lg:justify-between lg:gap-8">
        <div className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-mono text-sm font-medium tabular-nums text-muted-foreground">
              Ticket #{idLabel}
            </p>
            <Badge
              variant="secondary"
              className={cn(
                'border-transparent',
                finished
                  ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950/80 dark:text-emerald-100'
                  : 'bg-sky-100 text-sky-900 dark:bg-sky-950/80 dark:text-sky-100',
              )}
            >
              {finished ? 'Finalizado' : 'En proceso'}
            </Badge>
            <TicketPaymentBadge total={total} paid={paid} />
          </div>

          <div className="min-w-0 space-y-1">
            <h1 className="truncate text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              {clientId ? (
                <Link
                  href={`/clients/${clientId}/edit`}
                  className="outline-none transition-colors hover:text-foreground/80 focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {clientName || 'Cliente sin nombre'}
                </Link>
              ) : (
                clientName || 'Cliente sin nombre'
              )}
            </h1>
            <p className="text-sm text-muted-foreground">
              Espacio de trabajo del ticket
              {creatorName ? (
                <>
                  {' · '}
                  Creado por{' '}
                  <span className="font-medium text-foreground">
                    {creatorName}
                  </span>
                </>
              ) : null}
            </p>
          </div>
        </div>

        <div className="grid shrink-0 grid-cols-2 gap-3 sm:grid-cols-3 lg:min-w-[280px]">
          <div className="rounded-lg bg-muted/40 px-3 py-2.5">
            <p className="text-xs text-muted-foreground">Total</p>
            <p className="text-base font-semibold tabular-nums tracking-tight">
              <FormattedCurrency amount={total} />
            </p>
          </div>
          <div className="rounded-lg bg-muted/40 px-3 py-2.5">
            <p className="text-xs text-muted-foreground">Pagado</p>
            <p className="text-base font-semibold tabular-nums tracking-tight">
              <FormattedCurrency amount={paid} />
            </p>
          </div>
          <div className="col-span-2 rounded-lg bg-muted/40 px-3 py-2.5 sm:col-span-1">
            <p className="text-xs text-muted-foreground">Saldo</p>
            <p className="text-base font-semibold tabular-nums tracking-tight">
              <FormattedCurrency amount={balanceDue} />
            </p>
          </div>
        </div>
      </div>

      <dl className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
        <div className="flex min-w-0 gap-1.5">
          <dt>Fecha del ticket</dt>
          <dd className="font-medium text-foreground">
            <FormattedDate date={ticketDate} />
          </dd>
        </div>
        <div className="flex min-w-0 gap-1.5">
          <dt>Creado</dt>
          <dd className="font-medium text-foreground">
            <FormattedDate date={createdAt} withTime />
          </dd>
        </div>
        <div className="flex min-w-0 gap-1.5">
          <dt>Actualizado</dt>
          <dd className="font-medium text-foreground">
            <FormattedDate date={updatedAt ?? createdAt} withTime />
          </dd>
        </div>
      </dl>
    </header>
  );
};
