'use client';

import type { ReactNode } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import type { Company } from '@/db/schema';
import { ListShortDate, ListSortableHeader } from '@/components/list-page';

export type Permission = {
  id: number;
  name: string;
  description: string | null;
  created_at: Date;
  company: Company | null;
};

export type PermissionsColumnsOptions = {
  renderActions: (permission: Permission) => ReactNode;
};

/** The desktop table of the permission catalog (ZIG-I33); phones draw cards. */
export const createPermissionsColumns = ({
  renderActions,
}: PermissionsColumnsOptions): ColumnDef<Permission>[] => [
  {
    id: 'name',
    accessorKey: 'name',
    header: ({ column }) => <ListSortableHeader column={column} label="Nombre" />,
    cell: ({ row }) => (
      <span className="line-clamp-2 font-medium">{row.original.name}</span>
    ),
    sortingFn: (a, b) =>
      a.original.name.localeCompare(b.original.name, 'es', {
        sensitivity: 'base',
      }),
    meta: { className: 'w-64' },
  },
  {
    id: 'companyName',
    accessorFn: (row) => row.company?.name ?? '',
    header: ({ column }) => <ListSortableHeader column={column} label="Empresa" />,
    cell: ({ row }) => (
      <span className="line-clamp-2">{row.original.company?.name ?? 'Sin empresa'}</span>
    ),
    sortingFn: (a, b) => {
      const na = a.original.company?.name ?? '';
      const nb = b.original.company?.name ?? '';
      return na.localeCompare(nb, 'es', { sensitivity: 'base' });
    },
    meta: { className: 'w-40' },
  },
  {
    id: 'description',
    accessorFn: (row) => row.description ?? '',
    header: ({ column }) => <ListSortableHeader column={column} label="Descripción" />,
    cell: ({ row }) => (
      <span className="line-clamp-2">{row.original.description ?? '—'}</span>
    ),
    sortingFn: (a, b) => {
      const da = a.original.description ?? '';
      const db = b.original.description ?? '';
      return da.localeCompare(db, 'es', { sensitivity: 'base' });
    },
  },
  {
    id: 'created_at',
    accessorFn: (row) => row.created_at,
    header: ({ column }) => <ListSortableHeader column={column} label="Creado" />,
    cell: ({ row }) => <ListShortDate date={row.original.created_at} />,
    sortingFn: (rowA, rowB) => {
      const ta = rowA.original.created_at?.getTime() ?? 0;
      const tb = rowB.original.created_at?.getTime() ?? 0;
      return ta - tb;
    },
    meta: { className: 'w-28' },
  },
  {
    id: 'actions',
    header: () => <span className="sr-only">Acciones</span>,
    enableSorting: false,
    cell: ({ row }) => renderActions(row.original),
    meta: { className: 'w-12' },
  },
];
