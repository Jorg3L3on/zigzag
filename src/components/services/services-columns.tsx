'use client';

import type { Service } from '@/db/schema';
import type { Column, ColumnDef } from '@tanstack/react-table';
import type { ReactNode } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FormattedCurrency } from '@/components/formatted-currency';
import { cn } from '@/lib/utils';

function ServiceSortableHeader<TData>({
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

export type ServicesColumnsOptions = {
  renderActions: (service: Service) => ReactNode;
};

export const createServicesColumns = ({
  renderActions,
}: ServicesColumnsOptions): ColumnDef<Service>[] => [
  {
    id: 'name',
    accessorKey: 'name',
    header: ({ column }) => (
      <ServiceSortableHeader column={column} label="Nombre" />
    ),
    cell: ({ row }) => (
      <span className="font-medium">{row.original.name}</span>
    ),
    sortingFn: (a, b) => {
      const na = a.original.name.toLocaleLowerCase();
      const nb = b.original.name.toLocaleLowerCase();
      return na.localeCompare(nb, 'es');
    },
  },
  {
    id: 'description',
    accessorKey: 'description',
    header: ({ column }) => (
      <ServiceSortableHeader column={column} label="Descripción" />
    ),
    cell: ({ row }) => (
      <span className="line-clamp-2 max-w-md text-muted-foreground">
        {row.original.description}
      </span>
    ),
    sortingFn: (a, b) => {
      const na = a.original.description.toLocaleLowerCase();
      const nb = b.original.description.toLocaleLowerCase();
      return na.localeCompare(nb, 'es');
    },
  },
  {
    id: 'status',
    accessorFn: (row) => (row.deleted_at ? 1 : 0),
    header: ({ column }) => (
      <ServiceSortableHeader column={column} label="Estado" />
    ),
    cell: ({ row }) => (
      <span
        className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
          row.original.deleted_at
            ? 'bg-destructive/10 text-destructive'
            : 'bg-emerald-100 text-emerald-700'
        }`}
      >
        {row.original.deleted_at ? 'Eliminado' : 'Activo'}
      </span>
    ),
  },
  {
    id: 'price',
    accessorFn: (row) => row.price,
    header: ({ column }) => (
      <ServiceSortableHeader
        column={column}
        label="Precio"
        className="justify-end"
      />
    ),
    cell: ({ row }) => (
      <div className="text-right tabular-nums">
        <FormattedCurrency amount={row.original.price} />
      </div>
    ),
    sortingFn: (rowA, rowB) => rowA.original.price - rowB.original.price,
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
        {renderActions(row.original)}
      </div>
    ),
  },
];
