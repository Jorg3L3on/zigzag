'use client';

import type { Client } from '@/actions/clients';
import type { Column, ColumnDef } from '@tanstack/react-table';
import type { ReactNode } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FormattedDate } from '@/components/formatted-date';
import { cn } from '@/lib/utils';
import { formatClientAddressOneLine } from '@/lib/client-address';

function ClientSortableHeader<TData>({
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

export type ClientsColumnsOptions = {
  renderActions: (row: Client) => ReactNode;
};

export const createClientsColumns = ({
  renderActions,
}: ClientsColumnsOptions): ColumnDef<Client>[] => [
  {
    id: 'id',
    accessorFn: (row) => row.id,
    header: ({ column }) => (
      <ClientSortableHeader column={column} label="ID" />
    ),
    cell: ({ row }) => (
      <span className="tabular-nums">{row.original.id}</span>
    ),
  },
  {
    id: 'name',
    accessorKey: 'name',
    header: ({ column }) => (
      <ClientSortableHeader column={column} label="Nombre" />
    ),
    cell: ({ row }) => (
      <span className="line-clamp-2 max-w-[14rem] font-medium">
        {row.original.name}
      </span>
    ),
    sortingFn: (a, b) => {
      const na = a.original.name.toLocaleLowerCase();
      const nb = b.original.name.toLocaleLowerCase();
      return na.localeCompare(nb, 'es');
    },
  },
  {
    id: 'phone',
    accessorFn: (row) => row.phone ?? '',
    header: ({ column }) => (
      <ClientSortableHeader column={column} label="Teléfono" />
    ),
    cell: ({ row }) => (
      <span className="line-clamp-1 max-w-[10rem] tabular-nums">
        {row.original.phone || '—'}
      </span>
    ),
    sortingFn: (a, b) => {
      const na = a.original.phone ?? '';
      const nb = b.original.phone ?? '';
      return na.localeCompare(nb, 'es', { numeric: true });
    },
  },
  {
    id: 'email',
    accessorFn: (row) => row.email ?? '',
    header: ({ column }) => (
      <ClientSortableHeader column={column} label="Correo" />
    ),
    cell: ({ row }) => (
      <span className="line-clamp-1 max-w-[14rem]">
        {row.original.email?.trim() ? row.original.email : '—'}
      </span>
    ),
    sortingFn: (a, b) => {
      const na = (a.original.email ?? '').toLocaleLowerCase();
      const nb = (b.original.email ?? '').toLocaleLowerCase();
      return na.localeCompare(nb, 'es');
    },
  },
  {
    id: 'address',
    accessorFn: (row) => formatClientAddressOneLine(row),
    header: ({ column }) => (
      <ClientSortableHeader column={column} label="Dirección" />
    ),
    cell: ({ row }) => (
      <span className="line-clamp-2 max-w-[16rem] text-muted-foreground">
        {formatClientAddressOneLine(row.original) || '—'}
      </span>
    ),
    sortingFn: (a, b) => {
      const na = formatClientAddressOneLine(a.original).toLocaleLowerCase();
      const nb = formatClientAddressOneLine(b.original).toLocaleLowerCase();
      return na.localeCompare(nb, 'es');
    },
  },
  {
    id: 'created_at',
    accessorFn: (row) => row.created_at?.getTime() ?? 0,
    header: ({ column }) => (
      <ClientSortableHeader column={column} label="Alta" />
    ),
    cell: ({ row }) => <FormattedDate date={row.original.created_at} />,
    sortingFn: (rowA, rowB) => {
      const ta = rowA.original.created_at?.getTime() ?? 0;
      const tb = rowB.original.created_at?.getTime() ?? 0;
      return ta - tb;
    },
  },
  {
    id: 'actions',
    enableSorting: false,
    header: () => <span className="sr-only">Acciones</span>,
    cell: ({ row }) => (
      <div
        className="flex justify-end"
        onPointerDown={(event) => event.stopPropagation()}
      >
        {renderActions(row.original)}
      </div>
    ),
  },
];
