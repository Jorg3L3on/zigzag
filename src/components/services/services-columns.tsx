'use client';

import type { Service } from '@/db/schema';
import type { Column, ColumnDef } from '@tanstack/react-table';
import type { ReactNode } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FormattedCurrency } from '@/components/formatted-currency';
import { LIST_SORTABLE_HEADER_CLASS } from '@/components/list-filter/list-desktop';
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

/** Default materials count; list rows carry `materials` since ZIG-I10. */
export const serviceMaterialCount = (service: Service): number =>
  (service as Service & { materials?: unknown[] }).materials?.length ?? 0;

export const formatMaterialCount = (count: number): string =>
  count === 1 ? '1 material' : `${count} materiales`;

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
    // One line, like the clients list; the full name on hover (ZIG-30).
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
    id: 'description',
    accessorKey: 'description',
    // Below 1280px the description gives its room to Precio and ⋮ (ZIG-I27-2).
    meta: { className: 'hidden xl:table-cell' },
    header: ({ column }) => (
      <ServiceSortableHeader column={column} label="Descripción" />
    ),
    cell: ({ row }) => (
      <span className="block truncate text-muted-foreground" title={row.original.description}>
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
    meta: { className: 'w-[112px]' },
    header: ({ column }) => (
      <ServiceSortableHeader column={column} label="Estado" />
    ),
    cell: ({ row }) => (
      <span
        className={`inline-flex rounded-full px-2 py-1 text-caption font-medium ${
          row.original.deleted_at
            ? 'bg-destructive/10 text-destructive'
            : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-100'
        }`}
      >
        {row.original.deleted_at ? 'Eliminado' : 'Activo'}
      </span>
    ),
  },
  {
    id: 'materials',
    accessorFn: (row) => serviceMaterialCount(row),
    meta: { className: 'w-[120px]' },
    header: ({ column }) => (
      <ServiceSortableHeader column={column} label="Materiales" />
    ),
    cell: ({ row }) => {
      const count = serviceMaterialCount(row.original);
      return (
        <span className="tabular-nums text-muted-foreground">
          {count > 0 ? count : '—'}
        </span>
      );
    },
  },
  {
    id: 'price',
    accessorFn: (row) => row.price,
    meta: { className: 'w-[132px]' },
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
