'use client';

import { formatDocumentFolio } from '@/lib/folio';
import type { Ticket } from '@/actions/tickets';
import type { ColumnDef } from '@tanstack/react-table';
import type { Column } from '@tanstack/react-table';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FormattedCurrency } from '@/components/formatted-currency';
import type { TicketListCollectPaymentResult } from '@/components/tickets/ticket-list-collect-payment-dialog';
import { TicketRowActions } from '@/components/tickets/ticket-row-actions';
import { hrefForTicketListRow } from '@/lib/ticket-list-navigation';
import {
  getTicketBalanceDue,
  getTicketPaymentStatus,
  getTicketPaymentStatusSortRank,
} from '@/lib/ticket-payment-status';
import { cn } from '@/lib/utils';
import { formatPhoneDisplay } from '@/lib/phone-links';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

function TicketSortableHeader<TData>({
  column,
  label,
  className,
}: {
  column: Column<TData>;
  label: string;
  className?: string;
}) {
  const sorted = column.getIsSorted();

  return (
    <Button
      type="button"
      variant="ghost"
      className={cn(
        '-ml-2 h-7 max-w-full px-2 text-sm font-medium hover:bg-transparent',
        className,
      )}
      onClick={column.getToggleSortingHandler()}
    >
      {label}
      {sorted === 'desc' ? (
        <ArrowDown className="ml-2 h-4 w-4 shrink-0" aria-hidden data-icon="inline-end"/>
      ) : sorted === 'asc' ? (
        <ArrowUp className="ml-2 h-4 w-4 shrink-0" aria-hidden data-icon="inline-end"/>
      ) : (
        <ArrowUpDown className="ml-2 h-4 w-4 shrink-0 opacity-60" aria-hidden data-icon="inline-end"/>
      )}
    </Button>
  );
}

/** Short date on one line, `mié 22 oct`, with the full date on hover (ZIG-I27-2). */
/** «10 oct», with the year only when it is not this one (canvas ListaA). */
const TicketListDate = ({ date }: { date: Date | null }) => {
  if (!date) return <span className="text-muted-foreground">Sin fecha</span>;
  const value = new Date(date);
  const pattern = value.getFullYear() === new Date().getFullYear() ? 'd MMM' : 'd MMM yyyy';
  return (
    <span
      className="whitespace-nowrap tabular-nums text-slate-600 dark:text-slate-300"
      title={format(value, 'PPP', { locale: es })}
    >
      {format(value, pattern, { locale: es })}
    </span>
  );
};

export type TicketListEstadoLabel = 'Pagado' | 'Pago parcial' | 'Pendiente' | 'En proceso';

/**
 * One-line estado. A ticket still in progress is En proceso when it would
 * otherwise read Pendiente (ZIG-I28-4).
 */
const PAYMENT_ESTADO_LABEL: Record<
  ReturnType<typeof getTicketPaymentStatus>,
  TicketListEstadoLabel
> = {
  paid: 'Pagado',
  partial: 'Pago parcial',
  pending: 'Pendiente',
};

export const ticketListEstadoLabel = (
  ticket: Pick<Ticket, 'finished' | 'total' | 'paid'>,
): TicketListEstadoLabel => {
  // Unfinished work reads En proceso whatever was paid in advance, like the detail pill.
  if (!ticket.finished) {
    return 'En proceso';
  }
  return PAYMENT_ESTADO_LABEL[getTicketPaymentStatus(ticket.total, ticket.paid)];
};

const ESTADO_CLASS: Record<TicketListEstadoLabel, string> = {
  Pagado: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  'Pago parcial': 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  Pendiente: 'bg-slate-500/15 text-slate-700 dark:text-slate-300',
  'En proceso': 'bg-sky-500/15 text-sky-700 dark:text-sky-300',
};

const TicketListEstadoChip = ({ ticket }: { ticket: Ticket }) => {
  const label = ticketListEstadoLabel(ticket);
  return (
    <span
      data-testid="ticket-list-estado"
      className={cn(
        'inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-caption font-medium',
        ESTADO_CLASS[label],
      )}
    >
      {label}
    </span>
  );
};

/** Em dash when the ticket is still En proceso or the saldo is already 0. */
const TicketListSaldo = ({ ticket }: { ticket: Ticket }) => {
  const balance = getTicketBalanceDue(ticket.total, ticket.paid);
  if (!ticket.finished || balance <= 0) {
    return <span className="text-muted-foreground">—</span>;
  }
  return (
    <span className="font-semibold tabular-nums">
      <FormattedCurrency amount={balance} />
    </span>
  );
};

export type TicketsColumnsOptions = {
  onDelete: (id: number) => void;
  onDeleteFailed?: (id: number) => void;
  onPaymentApplied?: (result: TicketListCollectPaymentResult) => void;
  canWrite?: boolean;
  companyId?: number | null;
};

export const createTicketsColumns = ({
  onDelete,
  onDeleteFailed,
  onPaymentApplied,
  canWrite = true,
  companyId,
}: TicketsColumnsOptions): ColumnDef<Ticket>[] => [
  {
    id: 'id',
    accessorFn: (row) => Number(row.id),
    // Widths follow the list's container, not the viewport: the sidebar takes 256px, and
    // unsized columns split the row evenly (Cliente was ~110px at 1280, PR #610 review).
    meta: { className: 'w-[6rem]' },
    header: ({ column }) => (
      <TicketSortableHeader column={column} label="Folio" />
    ),
    cell: ({ row }) => (
      <span className="font-mono text-caption tabular-nums">
        {formatDocumentFolio(row.original)}
      </span>
    ),
  },
  {
    id: 'client_name',
    accessorKey: 'client_name',
    // Takes what is left (about 330px at 1280 with the sidebar) until Trabajo shows; then
    // 21rem, as wide as at 1280: client names win over Trabajo, as on the presupuestos table.
    meta: { className: '@min-[75rem]:w-[21rem]' },
    header: ({ column }) => (
      <TicketSortableHeader column={column} label="Cliente" />
    ),
    cell: ({ row }) => {
      const name = row.original.client_name?.trim() || '—';
      const phone = row.original.client_tel?.trim();
      return (
        <div className="min-w-0">
          <p className="truncate text-sm font-medium leading-5" title={name}>
            {name}
          </p>
          {phone ? (
            <p className="truncate text-caption leading-4 tabular-nums text-muted-foreground">
              {formatPhoneDisplay(phone) ?? phone}
            </p>
          ) : null}
        </div>
      );
    },
    sortingFn: (a, b) => {
      const na = (a.original.client_name ?? '').toLocaleLowerCase();
      const nb = (b.original.client_name ?? '').toLocaleLowerCase();
      return na.localeCompare(nb, 'es');
    },
  },
  {
    id: 'client_tel',
    accessorKey: 'client_tel',
    // Hidden: the number sits under the client. The column stays so "Teléfono" sort still works.
    meta: { className: 'hidden' },
    header: () => null,
    cell: () => null,
    enableHiding: true,
    sortingFn: (a, b) => {
      const na = a.original.client_tel ?? '';
      const nb = b.original.client_tel ?? '';
      return na.localeCompare(nb, 'es', { numeric: true });
    },
  },
  {
    id: 'services',
    accessorFn: (row) => row.services_summary ?? '',
    // Only once Cliente keeps 21rem and Trabajo gets the canvas's 220px (75rem list, ~1504 with the sidebar).
    meta: { className: 'hidden @min-[75rem]:table-cell' },
    header: () => <span>Trabajo</span>,
    cell: ({ row }) => {
      const summary = row.original.services_summary?.trim();
      if (!summary) {
        return <span className="text-muted-foreground">Sin servicios todavía</span>;
      }
      // «A, B… +5»: the first two names, then how many more (canvas ListaA).
      const head = row.original.services_head?.length ? row.original.services_head.join(', ') : summary;
      const more = Math.max((row.original.services_count ?? 0) - 2, 0);
      return (
        <span className="flex min-w-0 items-baseline gap-1 text-[13px] text-slate-600 dark:text-slate-300" title={summary}>
          <span className="truncate">{head}</span>
          {more > 0 ? <span className="shrink-0 text-muted-foreground/70">+{more}</span> : null}
        </span>
      );
    },
  },
  {
    id: 'ticket_date',
    accessorFn: (row) => row.ticket_date,
    meta: { className: 'hidden w-[6.5rem] @min-[48rem]:table-cell' },
    header: ({ column }) => (
      <TicketSortableHeader column={column} label="Fecha" />
    ),
    cell: ({ row }) => <TicketListDate date={row.original.ticket_date} />,
    sortingFn: (rowA, rowB) => {
      const ta = rowA.original.ticket_date?.getTime();
      const tb = rowB.original.ticket_date?.getTime();
      if (ta == null && tb == null) return 0;
      if (ta == null) return 1;
      if (tb == null) return -1;
      return ta - tb;
    },
  },
  {
    id: 'total',
    accessorFn: (row) => row.total ?? NaN,
    size: 110,
    meta: { className: 'w-[8.5rem]' },
    header: ({ column }) => (
      <TicketSortableHeader
        column={column}
        label="Total"
        className="justify-end"
      />
    ),
    cell: ({ row }) => (
      <div className="text-right font-medium tabular-nums">
        <FormattedCurrency amount={row.original.total} />
      </div>
    ),
    sortingFn: (rowA, rowB) => {
      const a = rowA.original.total ?? -Infinity;
      const b = rowB.original.total ?? -Infinity;
      return a - b;
    },
  },
  {
    id: 'balance',
    accessorFn: (row) => getTicketBalanceDue(row.total, row.paid),
    meta: { className: 'w-[8.5rem]' },
    header: ({ column }) => (
      <TicketSortableHeader column={column} label="Saldo" className="justify-end" />
    ),
    cell: ({ row }) => (
      <div className="text-right tabular-nums">
        <TicketListSaldo ticket={row.original} />
      </div>
    ),
    sortingFn: (rowA, rowB) =>
      getTicketBalanceDue(rowA.original.total, rowA.original.paid) -
      getTicketBalanceDue(rowB.original.total, rowB.original.paid),
  },
  {
    id: 'paymentRank',
    accessorFn: (row) => getTicketPaymentStatusSortRank(row.total, row.paid),
    meta: { className: 'w-[7.5rem]' },
    header: ({ column }) => (
      <TicketSortableHeader column={column} label="Estado" />
    ),
    cell: ({ row }) => <TicketListEstadoChip ticket={row.original} />,
  },
  {
    id: 'actions',
    enableSorting: false,
    // Only ⋯: no buttons appear on hover, Terminar, Cobrar and the PDF live in the menu (ZIG-33).
    meta: { className: 'w-[3.25rem]' },
    header: () => <span className="sr-only">Acciones</span>,
    cell: ({ row }) => (
      <div
        className="flex justify-end"
        onClick={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <TicketRowActions
          ticket={row.original}
          onDelete={onDelete}
          onDeleteFailed={onDeleteFailed}
          onPaymentApplied={onPaymentApplied}
          canWrite={canWrite}
          companyId={companyId}
          triggerIcon="horizontal"
          finishHref={
            row.original.services_summary?.trim()
              ? hrefForTicketListRow(row.original, canWrite)
              : undefined
          }
        />
      </div>
    ),
  },
];
