'use client';

import type { Service } from '@/db/schema';
import type { ColumnDef } from '@tanstack/react-table';
import type { ReactNode } from 'react';
import { FormattedCurrency } from '@/components/formatted-currency';
import { ListSortableHeader, ListStatusPill } from '@/components/list-page';

/** Default materials count; list rows carry `materials` since ZIG-I10. */
export const serviceMaterialCount = (service: Service): number =>
  (service as Service & { materials?: unknown[] }).materials?.length ?? 0;

export const formatMaterialCount = (count: number): string =>
  count === 1 ? '1 material' : `${count} materiales`;

export type ServicesColumnsOptions = {
  renderActions: (service: Service) => ReactNode;
};

/**
 * The desktop table (from lg). Sorting is by header only; `ListTable` puts
 * `aria-sort` on the th and right-aligns Precio from its meta (ZIG-I33).
 */
export const createServicesColumns = ({
  renderActions,
}: ServicesColumnsOptions): ColumnDef<Service>[] => [
  {
    id: 'name',
    accessorKey: 'name',
    header: ({ column }) => (
      <ListSortableHeader column={column} label="Nombre" />
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
      <ListSortableHeader column={column} label="Descripción" />
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
      <ListSortableHeader column={column} label="Estado" />
    ),
    // Deleted stays red, as on the phone card (ZIG-I33 §6).
    cell: ({ row }) =>
      row.original.deleted_at ? (
        <ListStatusPill tone="red">Eliminado</ListStatusPill>
      ) : (
        <ListStatusPill tone="emerald">Activo</ListStatusPill>
      ),
  },
  {
    id: 'materials',
    accessorFn: (row) => serviceMaterialCount(row),
    meta: { className: 'w-[120px]' },
    header: ({ column }) => (
      <ListSortableHeader column={column} label="Materiales" />
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
    meta: { className: 'w-[132px]', align: 'right' },
    header: ({ column }) => (
      <ListSortableHeader column={column} label="Precio" align="right" />
    ),
    cell: ({ row }) => <FormattedCurrency amount={row.original.price} />,
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
