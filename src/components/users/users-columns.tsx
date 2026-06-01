'use client';

import type { Company, Role, User } from '@/db/schema';
import type { Column, ColumnDef } from '@tanstack/react-table';
import type { ReactNode } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FormattedDate } from '@/components/formatted-date';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export type UserWithRelations = User & {
  company: Company | null;
  role: Role | null;
};

function UserSortableHeader<TData>({
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

export type UsersColumnsOptions = {
  renderActions: (user: UserWithRelations) => ReactNode;
};

export const createUsersColumns = ({
  renderActions,
}: UsersColumnsOptions): ColumnDef<UserWithRelations>[] => [
  {
    id: 'id',
    accessorFn: (row) => row.id,
    header: ({ column }) => <UserSortableHeader column={column} label="ID" />,
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
  },
  {
    id: 'name',
    accessorKey: 'name',
    header: ({ column }) => (
      <UserSortableHeader column={column} label="Nombre" />
    ),
    cell: ({ row }) => (
      <span className="line-clamp-2 max-w-[12rem] font-medium">
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
    id: 'email',
    accessorKey: 'email',
    header: ({ column }) => (
      <UserSortableHeader column={column} label="Correo" />
    ),
    cell: ({ row }) => (
      <span className="line-clamp-2 max-w-[14rem]">{row.original.email}</span>
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
    header: ({ column }) => (
      <UserSortableHeader column={column} label="Empresa" />
    ),
    cell: ({ row }) => (
      <span className="line-clamp-2 max-w-[12rem]">
        {row.original.company?.name ?? 'Sin empresa'}
      </span>
    ),
    sortingFn: (a, b) => {
      const na = (a.original.company?.name ?? '').toLocaleLowerCase();
      const nb = (b.original.company?.name ?? '').toLocaleLowerCase();
      return na.localeCompare(nb, 'es');
    },
  },
  {
    id: 'roleName',
    accessorFn: (row) => row.role?.name ?? '',
    header: ({ column }) => <UserSortableHeader column={column} label="Rol" />,
    cell: ({ row }) => (
      <span className="line-clamp-2 max-w-[10rem]">
        {row.original.role?.name ?? 'Sin rol'}
      </span>
    ),
    sortingFn: (a, b) => {
      const na = (a.original.role?.name ?? '').toLocaleLowerCase();
      const nb = (b.original.role?.name ?? '').toLocaleLowerCase();
      return na.localeCompare(nb, 'es');
    },
  },
  {
    id: 'emailVerifiedRank',
    accessorFn: (row) => (row.email_verified_at ? 1 : 0),
    header: ({ column }) => (
      <UserSortableHeader column={column} label="Correo verificado" />
    ),
    cell: ({ row }) =>
      row.original.email_verified_at ? (
        <Badge variant="secondary" className="font-normal">
          Sí
        </Badge>
      ) : (
        <Badge variant="outline" className="font-normal text-muted-foreground">
          No
        </Badge>
      ),
  },
  {
    id: 'created_at',
    accessorFn: (row) => row.created_at?.getTime() ?? 0,
    header: ({ column }) => <UserSortableHeader column={column} label="Alta" />,
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
    cell: ({ row }) => renderActions(row.original),
  },
];
