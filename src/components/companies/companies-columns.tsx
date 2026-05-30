'use client';

import type { Company } from '@/db/schema';
import type { Column, ColumnDef } from '@tanstack/react-table';
import type { ReactNode } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatCompanyAddressOneLine } from '@/lib/company-address';
import { companyLifecycleLabel } from '@/lib/company-lifecycle';
import { cn } from '@/lib/utils';

function CompanySortableHeader<TData>({
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

export type CompaniesColumnsOptions = {
  renderActions: (row: Company) => ReactNode;
  renderContextBadge: (row: Company) => ReactNode;
};

export const createCompaniesColumns = ({
  renderActions,
  renderContextBadge,
}: CompaniesColumnsOptions): ColumnDef<Company>[] => [
  {
    id: 'name',
    accessorKey: 'name',
    header: ({ column }) => (
      <CompanySortableHeader column={column} label="Nombre" />
    ),
    cell: ({ row }) => (
      <span className="line-clamp-2 max-w-[14rem] font-medium">
        {row.original.name}
      </span>
    ),
    sortingFn: (a, b) =>
      a.original.name.localeCompare(b.original.name, 'es'),
  },
  {
    id: 'phone',
    accessorKey: 'phone',
    header: ({ column }) => (
      <CompanySortableHeader column={column} label="Teléfono" />
    ),
    cell: ({ row }) => (
      <span className="tabular-nums">{row.original.phone}</span>
    ),
    sortingFn: (a, b) =>
      a.original.phone.localeCompare(b.original.phone, 'es', { numeric: true }),
  },
  {
    id: 'email',
    accessorKey: 'email',
    header: ({ column }) => (
      <CompanySortableHeader column={column} label="Correo" />
    ),
    cell: ({ row }) => (
      <span className="line-clamp-1 max-w-[14rem]">{row.original.email}</span>
    ),
    sortingFn: (a, b) =>
      a.original.email.localeCompare(b.original.email, 'es'),
  },
  {
    id: 'address',
    accessorFn: (row) => formatCompanyAddressOneLine(row),
    header: ({ column }) => (
      <CompanySortableHeader column={column} label="Dirección" />
    ),
    cell: ({ row }) => (
      <span className="line-clamp-2 max-w-[280px] text-sm text-muted-foreground">
        {formatCompanyAddressOneLine(row.original)}
      </span>
    ),
    sortingFn: (a, b) =>
      formatCompanyAddressOneLine(a.original).localeCompare(
        formatCompanyAddressOneLine(b.original),
        'es',
      ),
  },
  {
    id: 'status',
    accessorKey: 'status',
    header: ({ column }) => (
      <CompanySortableHeader column={column} label="Estado" />
    ),
    cell: ({ row }) => {
      const active = row.original.status === 'ACTIVE';
      return (
        <Badge variant={active ? 'default' : 'secondary'}>
          {companyLifecycleLabel(row.original.status)}
        </Badge>
      );
    },
    sortingFn: (a, b) =>
      a.original.status.localeCompare(b.original.status, 'es'),
  },
  {
    id: 'context',
    enableSorting: false,
    header: () => <span className="text-right">Empresa</span>,
    cell: ({ row }) => (
      <div className="text-right">{renderContextBadge(row.original)}</div>
    ),
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
