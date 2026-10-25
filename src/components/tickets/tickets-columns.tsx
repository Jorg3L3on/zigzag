'use client';

import { formatDocumentFolio } from '@/lib/folio';
import type { Ticket } from '@/actions/tickets';
import type { ColumnDef } from '@tanstack/react-table';
import type { Column } from '@tanstack/react-table';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FormattedCurrency } from '@/components/formatted-currency';
import type { TicketListCollectPaymentResult } from '@/components/tickets/ticket-list-collect-payment-dialog';
import { TicketListPaymentSummary } from '@/components/tickets/ticket-list-payment-summary';
import { TicketRowActions } from '@/components/tickets/ticket-row-actions';
import { getTicketBalanceDue, getTicketPaymentStatusSortRank } from '@/lib/ticket-payment-status';
import { cn } from '@/lib/utils';
import { formatListDate } from '@/lib/format-list-date';
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
      aria-sort={
        sorted === 'asc' ? 'ascending' : sorted === 'desc' ? 'descending' : 'none'
      }
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
const TicketListDate = ({ date }: { date: Date | null }) => {
  if (!date) return <span>Sin fecha</span>;
  return (
    <span className="whitespace-nowrap" title={format(new Date(date), 'PPP', { locale: es })}>
      {formatListDate(date)}
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
    header: ({ column }) => (
      <TicketSortableHeader column={column} label="Folio" />
    ),
    cell: ({ row }) => (
      <span className="tabular-nums">{formatDocumentFolio(row.original)}</span>
    ),
  },
  {
    id: 'client_name',
    accessorKey: 'client_name',
    header: ({ column }) => (
      <TicketSortableHeader column={column} label="Cliente" />
    ),
    // Long names truncate with the full name on hover, so Total and ⋮ fit (ZIG-I27-2).
    cell: ({ row }) => (
      <span className="block max-w-[9rem] truncate xl:max-w-[11rem]" title={row.original.client_name ?? undefined}>
        {row.original.client_name ?? '—'}
      </span>
    ),
    sortingFn: (a, b) => {
      const na = (a.original.client_name ?? '').toLocaleLowerCase();
      const nb = (b.original.client_name ?? '').toLocaleLowerCase();
      return na.localeCompare(nb, 'es');
    },
  },
  {
    id: 'client_tel',
    accessorKey: 'client_tel',
    // Below 1280px the phone gives its room to Total and ⋮ (ZIG-I27-2).
    meta: { className: 'hidden xl:table-cell' },
    header: ({ column }) => (
      <TicketSortableHeader column={column} label="Teléfono" />
    ),
    cell: ({ row }) => (
      <span className="tabular-nums">{row.original.client_tel?.trim() || '—'}</span>
    ),
    sortingFn: (a, b) => {
      const na = a.original.client_tel ?? '';
      const nb = b.original.client_tel ?? '';
      return na.localeCompare(nb, 'es', { numeric: true });
    },
  },
  {
    id: 'ticket_date',
    accessorFn: (row) => row.ticket_date,
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
    id: 'paymentRank',
    accessorFn: (row) =>
      getTicketPaymentStatusSortRank(row.total, row.paid),
    size: 180,
    minSize: 150,
    header: ({ column }) => (
      <TicketSortableHeader column={column} label="Estado" />
    ),
    cell: ({ row }) => (
      <TicketListPaymentSummary
        total={row.original.total}
        paid={row.original.paid}
      />
    ),
  },
  {
    id: 'total',
    accessorFn: (row) => row.total ?? NaN,
    size: 110,
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
    // Hidden column: only the phone sort "Mayor saldo" reads it (ZIG-I18-9).
    id: 'balance',
    accessorFn: (row) => getTicketBalanceDue(row.total, row.paid),
    header: () => null,
    cell: () => null,
    enableHiding: true,
  },
  {
    id: 'actions',
    enableSorting: false,
    size: 56,
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
        />
      </div>
    ),
  },
];
