'use client';

import Link from 'next/link';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { ColumnDef } from '@tanstack/react-table';
import type { CobranzaRow } from '@/lib/cobranza';
import { CobranzaRowActions } from '@/components/cobranza/cobranza-row-actions';
import { FormattedCurrency } from '@/components/formatted-currency';
import { companyDay } from '@/lib/company-day';
import { formatPhoneDisplay } from '@/lib/phone-links';
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

/** `2 ago 25`: the short date of the canvas, in the company's calendar. */
export const formatCobranzaDate = (value: Date | string): string =>
  format(companyDay(new Date(value)).date, 'd MMM yy', { locale: es }).replace('.', '');

/** Red past 90 days, amber from 31 (ZIG-I31-2). */
export const cobranzaDaysClassName = (days: number): string =>
  days > 90
    ? 'text-red-700 dark:text-red-400'
    : days > 30
      ? 'text-amber-800 dark:text-amber-300'
      : 'text-foreground';

/** A recent payment reads relative («hace 1 día»); an older one shows its date. */
const RELATIVE_PAYMENT_DAYS = 7;

/** «hoy», «hace 3 días», «3 ago 25»; null when nothing was paid yet. */
export const formatPaymentWhen = (
  lastPaymentAt: Date | string | null,
  daysSinceLastPayment: number | null,
): string | null => {
  if (lastPaymentAt == null || daysSinceLastPayment == null) return null;
  if (daysSinceLastPayment === 0) return 'hoy';
  if (daysSinceLastPayment <= RELATIVE_PAYMENT_DAYS) {
    return `hace ${plural(daysSinceLastPayment, 'día', 'días')}`;
  }
  return formatCobranzaDate(lastPaymentAt);
};

/** «último pago hace 1 día», «último pago 3 ago 25», «sin ningún pago». */
export const formatLastPayment = (
  lastPaymentAt: Date | string | null,
  daysSinceLastPayment: number | null,
): string => {
  const when = formatPaymentWhen(lastPaymentAt, daysSinceLastPayment);
  return when ? `último pago ${when}` : 'sin ningún pago';
};

export const CobranzaDaysCell = ({
  days,
  lastPaymentAt,
  daysSinceLastPayment,
}: {
  days: number;
  lastPaymentAt: Date | string | null;
  daysSinceLastPayment: number | null;
}) => (
  <div className="flex min-w-0 flex-col text-[13px] leading-[1.3]">
    <span
      className={cn('font-semibold tabular-nums', cobranzaDaysClassName(days))}
      data-testid="cobranza-days"
    >
      {plural(days, 'día', 'días')}
    </span>
    <span
      className="truncate text-xs font-normal tabular-nums text-muted-foreground"
      data-testid="cobranza-last-payment"
    >
      {formatLastPayment(lastPaymentAt, daysSinceLastPayment)}
    </span>
  </div>
);

/** The first two names of the work, then «+N» for the rest (canvas CobA). */
export const CobranzaWorkSummary = ({ row }: { row: CobranzaRow }) => {
  const summary = row.services_summary?.trim();
  if (!summary) {
    return <span className="text-[13px] text-muted-foreground">Sin servicios</span>;
  }
  const names = summary.split(', ');
  const extra = Math.max(row.services_count, names.length) - 2;
  return (
    <span className="block truncate text-[13px] text-slate-600 dark:text-slate-300" title={summary}>
      {extra > 0 ? `${names.slice(0, 2).join(', ')}…` : summary}
      {extra > 0 ? <span className="text-muted-foreground/80"> +{extra}</span> : null}
    </span>
  );
};

const workDate = (row: CobranzaRow): Date => new Date(row.ticket_date ?? row.created_at);

export const createCobranzaColumns = ({
  onCollect,
  canWrite = false,
  companyId = null,
  companyName = null,
}: CobranzaColumnsOptions): ColumnDef<CobranzaRow>[] => [
  {
    id: 'folio',
    meta: { className: 'w-[5.5rem]' },
    header: () => <span>Folio</span>,
    cell: ({ row }) => (
      <Link
        href={`/tickets/${row.original.id}`}
        className="font-mono text-[13px] tabular-nums underline-offset-4 hover:underline"
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
      const phone = formatPhoneDisplay(row.original.client_tel);
      return (
        <div className="min-w-0">
          <p className="truncate text-sm font-medium leading-[1.3]" title={name}>
            {name}
          </p>
          {phone ? (
            <p className="truncate text-xs tabular-nums leading-4 text-muted-foreground">{phone}</p>
          ) : null}
        </div>
      );
    },
  },
  {
    id: 'services',
    // At 1024 with the sidebar open, Trabajo yields so the money and ⋮ fit.
    meta: { className: 'hidden w-44 xl:table-cell' },
    header: () => <span>Trabajo</span>,
    cell: ({ row }) => <CobranzaWorkSummary row={row.original} />,
  },
  {
    id: 'date',
    // Días already says how old the work is; the date yields below xl too.
    meta: { className: 'hidden w-24 xl:table-cell' },
    header: () => <span>Fecha</span>,
    cell: ({ row }) => {
      const date = workDate(row.original);
      return (
        <span
          className="whitespace-nowrap tabular-nums text-slate-600 dark:text-slate-300"
          title={format(date, 'PPP', { locale: es })}
        >
          {formatCobranzaDate(date)}
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
    // Pagado is Total − Saldo; below xl it yields so the client name keeps room at 1024.
    meta: { className: 'hidden w-28 text-right xl:table-cell' },
    header: () => <span className="block text-right">Pagado</span>,
    cell: ({ row }) =>
      (row.original.paid ?? 0) > 0.01 ? (
        <div className="text-right tabular-nums text-slate-600 dark:text-slate-300">
          <FormattedCurrency amount={row.original.paid} />
        </div>
      ) : (
        <div className="text-right text-muted-foreground/70">—</div>
      ),
  },
  {
    id: 'balance',
    meta: { className: 'w-[7.5rem] text-right' },
    header: () => <span className="block text-right">Saldo</span>,
    cell: ({ row }) => (
      <div
        className="text-right font-semibold tabular-nums text-amber-700 dark:text-amber-300"
        data-testid="cobranza-balance"
      >
        <FormattedCurrency amount={row.original.balanceDue} />
      </div>
    ),
  },
  {
    id: 'days',
    meta: { className: 'w-40' },
    header: () => <span>Días sin pagar</span>,
    cell: ({ row }) => (
      <CobranzaDaysCell
        days={row.original.daysOutstanding}
        lastPaymentAt={row.original.last_payment_at}
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
