'use client';

import type { ReactNode } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import type { Column } from '@tanstack/react-table';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import type { Company } from '@/db/schema';
import { Button } from '@/components/ui/button';
import { FormattedDate } from '@/components/formatted-date';
import { cn } from '@/lib/utils';

export type Permission = {
  id: number;
  name: string;
  description: string | null;
  created_at: Date;
  company: Company | null;
};

function PermissionSortableHeader<TData>({
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
        sorted === 'asc'
          ? 'ascending'
          : sorted === 'desc'
            ? 'descending'
            : 'none'
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

export type PermissionsColumnsOptions = {
  renderActions: (permission: Permission) => ReactNode;
};

export const createPermissionsColumns = ({
  renderActions,
}: PermissionsColumnsOptions): ColumnDef<Permission>[] => [
  {
    id: 'name',
    accessorKey: 'name',
    header: ({ column }) => (
      <PermissionSortableHeader column={column} label="Nombre" />
    ),
    cell: ({ row }) => (
      <span className="line-clamp-2 font-medium">{row.original.name}</span>
    ),
    sortingFn: (a, b) =>
      a.original.name.localeCompare(b.original.name, 'es', {
        sensitivity: 'base',
      }),
  },
  {
    id: 'companyName',
    accessorFn: (row) => row.company?.name ?? '',
    header: ({ column }) => (
      <PermissionSortableHeader column={column} label="Empresa" />
    ),
    cell: ({ row }) => (
      <span className="line-clamp-2">{row.original.company?.name ?? 'N/A'}</span>
    ),
    sortingFn: (a, b) => {
      const na = a.original.company?.name ?? '';
      const nb = b.original.company?.name ?? '';
      return na.localeCompare(nb, 'es', { sensitivity: 'base' });
    },
  },
  {
    id: 'description',
    accessorFn: (row) => row.description ?? '',
    header: ({ column }) => (
      <PermissionSortableHeader column={column} label="Descripción" />
    ),
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
    header: ({ column }) => (
      <PermissionSortableHeader column={column} label="Creado" />
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
    header: () => (
      <span className="flex w-full justify-end text-sm font-medium">Acciones</span>
    ),
    enableSorting: false,
    cell: ({ row }) => (
      <div className="flex justify-end">{renderActions(row.original)}</div>
    ),
  },
];
