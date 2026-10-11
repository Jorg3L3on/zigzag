import Link from 'next/link';
import type { ReactNode } from 'react';
import { FormattedDate } from '@/components/formatted-date';
import { TicketDetailStatusPill } from '@/components/tickets/detail/ticket-detail-status-pill';
import { cn } from '@/lib/utils';

type TicketDetailHeaderProps = {
  ticketId: number | bigint;
  clientName: string | null;
  clientId: number | null;
  finished: boolean;
  total: number | null;
  paid: number | null;
  ticketDate: Date | null;
  creatorName: string | null;
  /** The presupuesto this ticket was converted from, if any. */
  fromPresupuestoId?: number | string | null;
  /** Primary / secondary actions (desktop). */
  actions?: ReactNode;
  className?: string;
};

/**
 * Title = the client (wraps), then `date · author · Desde presupuesto #N`.
 * Creado / Actualizado live under Actividad (ZIG-I13-4). On mobile the folio
 * and status sit in the app bar; here they show from `md`.
 */
export const TicketDetailHeader = ({
  ticketId,
  clientName,
  clientId,
  finished,
  total,
  paid,
  ticketDate,
  creatorName,
  fromPresupuestoId = null,
  actions,
  className,
}: TicketDetailHeaderProps) => {
  const idLabel = String(ticketId);

  return (
    <header className={cn('flex min-w-0 flex-col gap-2 md:gap-3', className)}>
      <div className="hidden flex-wrap items-center gap-2 md:flex">
        <p className="font-mono text-sm font-medium tabular-nums text-muted-foreground">
          Ticket #{idLabel}
        </p>
        <TicketDetailStatusPill finished={finished} total={total} paid={paid} />
      </div>

      <div className="min-w-0 space-y-1">
        <h1
          className="text-[19px] font-bold leading-snug tracking-tight text-foreground [overflow-wrap:anywhere] md:text-3xl md:font-semibold"
          data-testid="ticket-detail-title"
        >
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
        <p className="text-[13px] text-muted-foreground [overflow-wrap:anywhere] md:text-sm">
          <FormattedDate date={ticketDate} />
          {creatorName ? <> · {creatorName}</> : null}
          {fromPresupuestoId != null ? (
            <>
              {' · '}
              <Link
                href={`/presupuestos/${fromPresupuestoId}`}
                className="font-medium text-primary underline-offset-4 hover:underline"
                data-testid="ticket-from-presupuesto"
              >
                Desde presupuesto #{String(fromPresupuestoId)}
              </Link>
            </>
          ) : null}
        </p>
      </div>

      {actions ? <div className="hidden md:block">{actions}</div> : null}
    </header>
  );
};
