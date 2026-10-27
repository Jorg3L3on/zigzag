'use client';

import type { Company, Role, User } from '@/db/schema';
import type { ColumnDef } from '@tanstack/react-table';
import type { ReactNode } from 'react';
import {
  ListShortDate,
  ListSortableHeader,
  ListStatusPill,
} from '@/components/list-page';

export type UserWithRelations = User & {
  company: Company | null;
  role: Role | null;
};

export type UsersColumnsOptions = {
  renderActions: (user: UserWithRelations) => ReactNode;
};

/** The desktop table of the system users list (ZIG-I33); phones draw cards. */
export const createUsersColumns = ({
  renderActions,
}: UsersColumnsOptions): ColumnDef<UserWithRelations>[] => [
  {
    id: 'id',
    accessorFn: (row) => row.id,
    header: ({ column }) => <ListSortableHeader column={column} label="ID" />,
    cell: ({ row }) => (
      <span className="tabular-nums">{row.original.id.toString()}</span>
    ),
    sortingFn: (a, b) => {
      const x = a.original.id;
      const y = b.original.id;
      if (x < y) return -1;
      if (x > y) return 1;
      return 0;
    },
    meta: { className: 'w-16' },
  },
  {
    id: 'name',
    accessorKey: 'name',
    header: ({ column }) => <ListSortableHeader column={column} label="Nombre" />,
    cell: ({ row }) => (
      <span className="line-clamp-2 font-medium">{row.original.name}</span>
    ),
    sortingFn: (a, b) => {
      const na = a.original.name.toLocaleLowerCase();
      const nb = b.original.name.toLocaleLowerCase();
      return na.localeCompare(nb, 'es');
    },
  },
  {
    id: 'email',
    accessorKey: 'email',
    header: ({ column }) => <ListSortableHeader column={column} label="Correo" />,
    cell: ({ row }) => (
      <span className="block truncate" title={row.original.email}>
        {row.original.email}
      </span>
    ),
    sortingFn: (a, b) => {
      const na = a.original.email.toLocaleLowerCase();
      const nb = b.original.email.toLocaleLowerCase();
      return na.localeCompare(nb, 'es');
    },
  },
  {
    id: 'companyName',
    accessorFn: (row) => row.company?.name ?? '',
    header: ({ column }) => <ListSortableHeader column={column} label="Empresa" />,
    cell: ({ row }) => (
      <span className="line-clamp-2">{row.original.company?.name ?? 'Sin empresa'}</span>
    ),
    sortingFn: (a, b) => {
      const na = (a.original.company?.name ?? '').toLocaleLowerCase();
      const nb = (b.original.company?.name ?? '').toLocaleLowerCase();
      return na.localeCompare(nb, 'es');
    },
    meta: { className: 'w-32' },
  },
  {
    id: 'roleName',
    accessorFn: (row) => row.role?.name ?? '',
    header: ({ column }) => <ListSortableHeader column={column} label="Rol" />,
    cell: ({ row }) => (
      <span className="line-clamp-2">{row.original.role?.name ?? 'Sin rol'}</span>
    ),
    sortingFn: (a, b) => {
      const na = (a.original.role?.name ?? '').toLocaleLowerCase();
      const nb = (b.original.role?.name ?? '').toLocaleLowerCase();
      return na.localeCompare(nb, 'es');
    },
    meta: { className: 'w-28' },
  },
  {
    id: 'emailVerifiedRank',
    accessorFn: (row) => (row.email_verified_at ? 1 : 0),
    header: ({ column }) => (
      <ListSortableHeader column={column} label="Correo verificado" />
    ),
    cell: ({ row }) =>
      row.original.email_verified_at ? (
        <ListStatusPill tone="emerald">Sí</ListStatusPill>
      ) : (
        <ListStatusPill tone="slate">No</ListStatusPill>
      ),
    meta: { className: 'w-44' },
  },
  {
    id: 'created_at',
    accessorFn: (row) => row.created_at?.getTime() ?? 0,
    header: ({ column }) => <ListSortableHeader column={column} label="Alta" />,
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
    enableSorting: false,
    header: () => <span className="sr-only">Acciones</span>,
    cell: ({ row }) => renderActions(row.original),
    meta: { className: 'w-12' },
  },
];
