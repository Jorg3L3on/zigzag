'use client';

import Link from 'next/link';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { ColumnDef } from '@tanstack/react-table';
import type { CobranzaRow } from '@/lib/cobranza';
import { CobranzaRowActions } from '@/components/cobranza/cobranza-row-actions';
import { FormattedCurrency } from '@/components/formatted-currency';
import { formatListDate } from '@/lib/format-list-date';
import { cn } from '@/lib/utils';

export type CobranzaColumnsOptions = {
  onCollect: (row: CobranzaRow) => void;
  canWrite?: boolean;
  companyId?: number | null;
  companyName?: string | null;
};

/** The ticket shape TicketRowActions takes, for the phone cards. */
export const cobranzaRowToTicketActions = (row: CobranzaRow) => ({
  id: BigInt(row.id),
  finished: row.finished,
  total: row.total,
  paid: row.paid,
  client_name: row.client_name,
  ticket_date: row.ticket_date ? new Date(row.ticket_date) : null,
});

const plural = (count: number, one: string, many: string) =>
  `${count} ${count === 1 ? one : many}`;

/** Red past 90 days, amber from 31 (ZIG-I31-2). */
export const cobranzaDaysClassName = (days: number): string =>
  days > 90
    ? 'text-red-700 dark:text-red-400'
    : days > 30
      ? 'text-amber-800 dark:text-amber-300'
      : 'text-foreground';

/** «último pago hoy», «último pago ayer», «último pago hace N días», «sin ningún pago». */
export const formatLastPayment = (daysSinceLastPayment: number | null): string => {
  if (daysSinceLastPayment == null) return 'sin ningún pago';
  if (daysSinceLastPayment === 0) return 'último pago hoy';
  if (daysSinceLastPayment === 1) return 'último pago ayer';
  return `último pago hace ${daysSinceLastPayment} días`;
};

export const CobranzaDaysCell = ({
  days,
  daysSinceLastPayment,
}: {
  days: number;
  daysSinceLastPayment: number | null;
}) => (
  <div className="flex min-w-0 flex-col">
    <span
      className={cn('text-sm font-semibold tabular-nums leading-5', cobranzaDaysClassName(days))}
      data-testid="cobranza-days"
    >
      {plural(days, 'día', 'días')}
    </span>
    <span
      className="truncate text-caption leading-4 text-muted-foreground"
      data-testid="cobranza-last-payment"
    >
      {formatLastPayment(daysSinceLastPayment)}
    </span>
  </div>
);

const workDate = (row: CobranzaRow): Date => new Date(row.ticket_date ?? row.created_at);

export const createCobranzaColumns = ({
  onCollect,
  canWrite = false,
  companyId = null,
  companyName = null,
}: CobranzaColumnsOptions): ColumnDef<CobranzaRow>[] => [
  {
    id: 'folio',
    meta: { className: 'w-20' },
    header: () => <span>Folio</span>,
    cell: ({ row }) => (
      <Link
        href={`/tickets/${row.original.id}`}
        className="font-mono text-caption tabular-nums underline-offset-4 hover:underline"
        onClick={(event) => event.stopPropagation()}
        data-testid="cobranza-folio"
      >
        {row.original.folio}
      </Link>
    ),
  },
  {
    id: 'client',
    header: () => <span>Cliente</span>,
    cell: ({ row }) => {
      const name = row.original.client_name?.trim() || 'Sin cliente';
      const phone = row.original.client_tel?.trim();
      return (
        <div className="min-w-0">
          <p className="truncate text-sm font-medium leading-5" title={name}>
            {name}
          </p>
          {phone ? (
            <p className="truncate text-caption leading-4 text-muted-foreground">{phone}</p>
          ) : null}
        </div>
      );
    },
  },
  {
    id: 'services',
    // At 1024 with the sidebar open, Trabajo yields so the money and ⋮ fit.
    meta: { className: 'hidden w-40 xl:table-cell' },
    header: () => <span>Trabajo</span>,
    cell: ({ row }) => {
      const summary = row.original.services_summary?.trim();
      if (!summary) {
        return <span className="text-muted-foreground">Sin servicios</span>;
      }
      return (
        <span className="block truncate" title={summary}>
          {summary}
        </span>
      );
    },
  },
  {
    id: 'date',
    // Días already says how old the work is; the date yields below xl too.
    meta: { className: 'hidden w-24 xl:table-cell' },
    header: () => <span>Fecha</span>,
    cell: ({ row }) => {
      const date = workDate(row.original);
      return (
        <span className="whitespace-nowrap" title={format(date, 'PPP', { locale: es })}>
          {formatListDate(date)}
        </span>
      );
    },
  },
  {
    id: 'total',
    meta: { className: 'w-28 text-right' },
    header: () => <span className="block text-right">Total</span>,
    cell: ({ row }) => (
      <div className="text-right tabular-nums">
        <FormattedCurrency amount={row.original.total} />
      </div>
    ),
  },
  {
    id: 'paid',
    meta: { className: 'w-28 text-right' },
    header: () => <span className="block text-right">Pagado</span>,
    cell: ({ row }) => (
      <div className="text-right tabular-nums text-muted-foreground">
        {(row.original.paid ?? 0) > 0.01 ? (
          <FormattedCurrency amount={row.original.paid} />
        ) : (
          '—'
        )}
      </div>
    ),
  },
  {
    id: 'balance',
    meta: { className: 'w-28 text-right' },
    header: () => <span className="block text-right">Saldo</span>,
    cell: ({ row }) => (
      <div
        className="text-right font-semibold tabular-nums text-amber-800 dark:text-amber-300"
        data-testid="cobranza-balance"
      >
        <FormattedCurrency amount={row.original.balanceDue} />
      </div>
    ),
  },
  {
    id: 'days',
    meta: { className: 'w-32' },
    header: () => <span>Días sin pagar</span>,
    cell: ({ row }) => (
      <CobranzaDaysCell
        days={row.original.daysOutstanding}
        daysSinceLastPayment={row.original.daysSinceLastPayment}
      />
    ),
  },
  {
    id: 'actions',
    meta: { className: 'w-14' },
    header: () => <span className="sr-only">Acciones</span>,
    cell: ({ row }) => (
      <div
        className="flex justify-end"
        onClick={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
        onKeyDown={(event) => event.stopPropagation()}
      >
        <CobranzaRowActions
          row={row.original}
          canWrite={canWrite}
          companyId={companyId}
          companyName={companyName}
          onCollect={onCollect}
        />
      </div>
    ),
  },
];
