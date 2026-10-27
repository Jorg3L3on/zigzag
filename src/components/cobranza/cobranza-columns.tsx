'use client';

import Link from 'next/link';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { ColumnDef } from '@tanstack/react-table';
import type { CobranzaRow, CobranzaSort } from '@/lib/cobranza';
import { CobranzaRowActions } from '@/components/cobranza/cobranza-row-actions';
import { FormattedCurrency } from '@/components/formatted-currency';
import { ListShortDate, ListSortableHeader } from '@/components/list-page';
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

/**
 * ListShortDate as text («8 oct», «3 ago 2025»), for the lines that word a date
 * inside a sentence: the last payment. Date columns use ListShortDate (ZIG-I33 §6).
 */
export const formatCobranzaDate = (value: Date | string): string => {
  const day = companyDay(new Date(value)).date;
  const thisYear = companyDay(new Date()).date.getUTCFullYear();
  return format(day, day.getUTCFullYear() === thisYear ? 'd MMM' : 'd MMM yyyy', { locale: es });
};

/** Red past 90 days, amber from 31 (ZIG-I31-2). */
export const cobranzaDaysClassName = (days: number): string =>
  days > 90
    ? 'text-red-700 dark:text-red-400'
    : days > 30
      ? 'text-amber-800 dark:text-amber-300'
      : 'text-foreground';

/** A recent payment reads relative («hace 1 día»); an older one shows its date. */
const RELATIVE_PAYMENT_DAYS = 7;

/** «hoy», «hace 3 días», «3 ago 2025»; null when nothing was paid yet. */
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

/** «último pago hace 1 día», «último pago 3 ago 2025», «sin ningún pago». */
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

/**
 * The Por ticket column behind each server order (ZIG-I33-3): the header sorts, the
 * page sends `sort` and its direction to getCobranzaPaginated.
 */
export const COBRANZA_SORT_COLUMN = {
  folio: 'folio',
  client: 'client',
  recent: 'date',
  total: 'total',
  paid: 'paid',
  balance: 'balance',
  days: 'days',
} as const satisfies Record<CobranzaSort, string>;

export const createCobranzaColumns = ({
  onCollect,
  canWrite = false,
  companyId = null,
  companyName = null,
}: CobranzaColumnsOptions): ColumnDef<CobranzaRow>[] => [
  {
    id: 'folio',
    accessorFn: (row) => row.folio,
    sortDescFirst: false,
    meta: { className: 'w-[5.5rem]' },
    header: ({ column }) => <ListSortableHeader column={column} label="Folio" />,
    cell: ({ row }) => (
      <Link
        href={`/tickets/${row.original.id}`}
        className="font-mono tabular-nums underline-offset-4 hover:underline md:text-[13px]"
        data-testid="cobranza-folio"
      >
        {row.original.folio}
      </Link>
    ),
  },
  {
    id: 'client',
    accessorFn: (row) => row.client_name ?? '',
    sortDescFirst: false,
    header: ({ column }) => <ListSortableHeader column={column} label="Cliente" />,
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
    enableSorting: false,
    // Columns join as the window grows (sidebar open): Trabajo from 1536.
    meta: { className: 'hidden w-44 2xl:table-cell' },
    header: () => <span>Trabajo</span>,
    cell: ({ row }) => <CobranzaWorkSummary row={row.original} />,
  },
  {
    id: 'date',
    accessorFn: (row) => workDate(row).getTime(),
    sortDescFirst: true,
    // Días already says how old the work is; the date yields below xl too.
    meta: { className: 'hidden w-24 xl:table-cell' },
    header: ({ column }) => <ListSortableHeader column={column} label="Fecha" />,
    cell: ({ row }) => <ListShortDate date={workDate(row.original)} />,
  },
  {
    id: 'total',
    accessorFn: (row) => row.total ?? 0,
    sortDescFirst: true,
    // Total, Pagado and Fecha from 1280; below that Saldo and Días carry the row.
    meta: { className: 'hidden w-[6.5rem] xl:table-cell', align: 'right' },
    header: ({ column }) => <ListSortableHeader column={column} label="Total" align="right" />,
    cell: ({ row }) => <FormattedCurrency amount={row.original.total} />,
  },
  {
    id: 'paid',
    accessorFn: (row) => row.paid ?? 0,
    sortDescFirst: true,
    meta: { className: 'hidden w-[6.5rem] xl:table-cell', align: 'right' },
    header: ({ column }) => <ListSortableHeader column={column} label="Pagado" align="right" />,
    cell: ({ row }) =>
      (row.original.paid ?? 0) > 0.01 ? (
        <span className="text-slate-600 dark:text-slate-300">
          <FormattedCurrency amount={row.original.paid} />
        </span>
      ) : (
        <span className="text-muted-foreground/70">—</span>
      ),
  },
  {
    id: 'balance',
    accessorFn: (row) => row.balanceDue,
    sortDescFirst: true,
    meta: { className: 'w-28', align: 'right' },
    header: ({ column }) => <ListSortableHeader column={column} label="Saldo" align="right" />,
    cell: ({ row }) => (
      <span
        className="font-semibold text-amber-700 dark:text-amber-300"
        data-testid="cobranza-balance"
      >
        <FormattedCurrency amount={row.original.balanceDue} />
      </span>
    ),
  },
  {
    id: 'days',
    accessorFn: (row) => row.daysOutstanding,
    sortDescFirst: true,
    meta: { className: 'w-[9.5rem]' },
    header: ({ column }) => <ListSortableHeader column={column} label="Días sin pagar" />,
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
    enableSorting: false,
    // Cobrar always visible, then the ⋯ (ZIG-I33 §5).
    meta: { className: 'w-[8.5rem]' },
    header: () => <span className="sr-only">Acciones</span>,
    cell: ({ row }) => (
      <CobranzaRowActions
        row={row.original}
        canWrite={canWrite}
        companyId={companyId}
        companyName={companyName}
        onCollect={onCollect}
      />
    ),
  },
];
