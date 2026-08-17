import Link from 'next/link';
import type { ReactNode } from 'react';
import { FormattedDate } from '@/components/formatted-date';
import { TicketDetailMoneyBar } from '@/components/tickets/detail/ticket-detail-money-bar';
import { TicketDetailStatusChip } from '@/components/tickets/detail/ticket-detail-status-chip';
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
  /** Primary / secondary actions (desktop). */
  actions?: ReactNode;
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
  actions,
  className,
}: TicketDetailHeaderProps) => {
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
            <TicketDetailStatusChip
              finished={finished}
              total={total}
              paid={paid}
            />
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
              <FormattedDate date={ticketDate} />
              {creatorName ? (
                <>
                  {' · '}
                  {creatorName}
                </>
              ) : null}
            </p>
          </div>

          {actions ? (
            <div className="hidden md:block">{actions}</div>
          ) : null}
        </div>

        <TicketDetailMoneyBar total={total} paid={paid} />
      </div>

      <dl className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
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
