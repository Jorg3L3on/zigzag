'use client';

import type { Ticket } from '@/actions/tickets';
import type { ColumnDef } from '@tanstack/react-table';
import type { Column } from '@tanstack/react-table';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FormattedCurrency } from '@/components/formatted-currency';
import { FormattedDate } from '@/components/formatted-date';
import { TicketPaymentBadge } from '@/components/tickets/ticket-payment-badge';
import { TicketRowActions } from '@/components/tickets/ticket-row-actions';
import { getTicketPaymentStatusSortRank } from '@/lib/ticket-payment-status';
import { cn } from '@/lib/utils';

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
        <ArrowDown className="ml-2 h-4 w-4 shrink-0" aria-hidden />
      ) : sorted === 'asc' ? (
        <ArrowUp className="ml-2 h-4 w-4 shrink-0" aria-hidden />
      ) : (
        <ArrowUpDown className="ml-2 h-4 w-4 shrink-0 opacity-60" aria-hidden />
      )}
    </Button>
  );
}

export type TicketsColumnsOptions = {
  onDelete: (id: number) => void;
  canWrite?: boolean;
};

export const createTicketsColumns = ({
  onDelete,
  canWrite = true,
}: TicketsColumnsOptions): ColumnDef<Ticket>[] => [
  {
    id: 'id',
    accessorFn: (row) => Number(row.id),
    header: ({ column }) => (
      <TicketSortableHeader column={column} label="ID" />
    ),
    cell: ({ row }) => (
      <span className="tabular-nums">{row.original.id.toString()}</span>
    ),
  },
  {
    id: 'client_name',
    accessorKey: 'client_name',
    header: ({ column }) => (
      <TicketSortableHeader column={column} label="Cliente" />
    ),
    cell: ({ row }) => row.original.client_name ?? '—',
    sortingFn: (a, b) => {
      const na = (a.original.client_name ?? '').toLocaleLowerCase();
      const nb = (b.original.client_name ?? '').toLocaleLowerCase();
      return na.localeCompare(nb, 'es');
    },
  },
  {
    id: 'client_tel',
    accessorKey: 'client_tel',
    header: ({ column }) => (
      <TicketSortableHeader column={column} label="Teléfono" />
    ),
    cell: ({ row }) => (
      <span className="tabular-nums">{row.original.client_tel ?? '—'}</span>
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
    cell: ({ row }) => <FormattedDate date={row.original.ticket_date} />,
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
    header: ({ column }) => (
      <TicketSortableHeader column={column} label="Estado" />
    ),
    cell: ({ row }) => (
      <TicketPaymentBadge total={row.original.total} paid={row.original.paid} />
    ),
  },
  {
    id: 'total',
    accessorFn: (row) => row.total ?? NaN,
    header: ({ column }) => (
      <TicketSortableHeader column={column} label="Total" />
    ),
    cell: ({ row }) => (
      <FormattedCurrency amount={row.original.total} />
    ),
    sortingFn: (rowA, rowB) => {
      const a = rowA.original.total ?? -Infinity;
      const b = rowB.original.total ?? -Infinity;
      return a - b;
    },
  },
  {
    id: 'actions',
    enableSorting: false,
    header: () => <span className="sr-only">Acciones</span>,
    cell: ({ row }) => (
      <div
        className="flex justify-end"
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => event.stopPropagation()}
      >
        <TicketRowActions
          ticket={row.original}
          onDelete={onDelete}
          canWrite={canWrite}
        />
      </div>
    ),
  },
];
