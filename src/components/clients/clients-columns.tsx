'use client';

import type { Client } from '@/actions/clients';
import type { Column, ColumnDef } from '@tanstack/react-table';
import type { ReactNode } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  LIST_SORTABLE_HEADER_CLASS,
  ListShortDate,
} from '@/components/list-filter/list-desktop';
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
      className={cn(LIST_SORTABLE_HEADER_CLASS, className)}
      onClick={column.getToggleSortingHandler()}
      aria-sort={
        sorted === 'asc' ? 'ascending' : sorted === 'desc' ? 'descending' : 'none'
      }
    >
      {label}
      {sorted === 'desc' ? (
        <ArrowDown className="size-3 shrink-0" aria-hidden data-icon="inline-end"/>
      ) : sorted === 'asc' ? (
        <ArrowUp className="size-3 shrink-0" aria-hidden data-icon="inline-end"/>
      ) : (
        <ArrowUpDown className="size-3 shrink-0 opacity-60" aria-hidden data-icon="inline-end"/>
      )}
    </Button>
  );
}

export type ClientsColumnsOptions = {
  renderActions: (row: Client) => ReactNode;
};

/**
 * The desktop table (from md). Fixed widths for the short columns; Nombre and,
 * from xl, Dirección share the rest on one line each (ZIG-30).
 */
export const createClientsColumns = ({
  renderActions,
}: ClientsColumnsOptions): ColumnDef<Client>[] => [
  {
    id: 'id',
    accessorFn: (row) => row.id,
    meta: { className: 'w-[68px]' },
    header: ({ column }) => (
      <ClientSortableHeader column={column} label="ID" />
    ),
    cell: ({ row }) => (
      <span className="tabular-nums text-muted-foreground">{row.original.id}</span>
    ),
  },
  {
    id: 'name',
    accessorKey: 'name',
    header: ({ column }) => (
      <ClientSortableHeader column={column} label="Nombre" />
    ),
    cell: ({ row }) => (
      <span className="block truncate font-medium" title={row.original.name}>
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
    meta: { className: 'w-[136px]' },
    header: ({ column }) => (
      <ClientSortableHeader column={column} label="Teléfono" />
    ),
    cell: ({ row }) => (
      <span className="block truncate tabular-nums">
        {row.original.phone?.trim() || '—'}
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
    meta: { className: 'w-[200px] xl:w-[240px]' },
    header: ({ column }) => (
      <ClientSortableHeader column={column} label="Correo" />
    ),
    cell: ({ row }) => (
      <span className="block truncate" title={row.original.email ?? undefined}>
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
    // Below 1280px the address gives its room to Nombre (ZIG-I27-2).
    meta: { className: 'hidden xl:table-cell' },
    header: ({ column }) => (
      <ClientSortableHeader column={column} label="Dirección" />
    ),
    cell: ({ row }) => {
      const address = formatClientAddressOneLine(row.original);
      return (
        <span className="block truncate text-muted-foreground" title={address || undefined}>
          {address || '—'}
        </span>
      );
    },
    sortingFn: (a, b) => {
      const na = formatClientAddressOneLine(a.original).toLocaleLowerCase();
      const nb = formatClientAddressOneLine(b.original).toLocaleLowerCase();
      return na.localeCompare(nb, 'es');
    },
  },
  {
    id: 'created_at',
    accessorFn: (row) => row.created_at?.getTime() ?? 0,
    meta: { className: 'w-[104px]' },
    header: ({ column }) => (
      <ClientSortableHeader column={column} label="Alta" />
    ),
    cell: ({ row }) => <ListShortDate date={row.original.created_at} />,
    sortingFn: (rowA, rowB) => {
      const ta = rowA.original.created_at?.getTime() ?? 0;
      const tb = rowB.original.created_at?.getTime() ?? 0;
      return ta - tb;
    },
  },
  {
    id: 'actions',
    enableSorting: false,
    meta: { className: 'w-[56px]' },
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
