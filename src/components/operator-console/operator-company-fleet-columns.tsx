'use client';

import type { Column, ColumnDef } from '@tanstack/react-table';
import type { ReactNode } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { OperatorFleetRow } from '@/lib/company-operator-fleet';
import { cn } from '@/lib/utils';

function FleetSortableHeader<TData>({
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
        <ArrowUpDown
          className="ml-2 h-4 w-4 shrink-0 opacity-60"
          aria-hidden
        />
      )}
    </Button>
  );
}

export type OperatorFleetColumnsOptions = {
  renderActions: (row: OperatorFleetRow) => ReactNode;
  renderContextBadge: (row: OperatorFleetRow) => ReactNode;
  formatWhen: (iso: string | null) => string;
};

export const createOperatorFleetColumns = ({
  renderActions,
  renderContextBadge,
  formatWhen,
}: OperatorFleetColumnsOptions): ColumnDef<OperatorFleetRow>[] => [
  {
    id: 'name',
    accessorKey: 'name',
    header: ({ column }) => (
      <FleetSortableHeader column={column} label="Empresa" />
    ),
    cell: ({ row }) => (
      <div className="flex max-w-[16rem] flex-col gap-1">
        <span className="line-clamp-2 font-medium">{row.original.name}</span>
        {renderContextBadge(row.original)}
      </div>
    ),
    sortingFn: (a, b) => a.original.name.localeCompare(b.original.name, 'es'),
  },
  {
    id: 'lifecycle',
    accessorKey: 'lifecycleLabel',
    header: ({ column }) => (
      <FleetSortableHeader column={column} label="Estado" />
    ),
    cell: ({ row }) => (
      <Badge
        variant={row.original.lifecycle === 'ACTIVE' ? 'default' : 'secondary'}
      >
        {row.original.lifecycleLabel}
      </Badge>
    ),
  },
  {
    id: 'readiness',
    accessorFn: (row) => row.missingCount,
    header: ({ column }) => (
      <FleetSortableHeader column={column} label="Preparación" />
    ),
    cell: ({ row }) =>
      row.original.productionReady ? (
        <Badge variant="default">Lista</Badge>
      ) : (
        <Badge variant="secondary">
          {row.original.missingCount} pendiente
          {row.original.missingCount === 1 ? '' : 's'}
        </Badge>
      ),
  },
  {
    id: 'lastActivityAt',
    accessorFn: (row) => row.lastActivityAt ?? '',
    header: ({ column }) => (
      <FleetSortableHeader column={column} label="Última actividad" />
    ),
    cell: ({ row }) => (
      <span className="text-sm text-muted-foreground">
        {formatWhen(row.original.lastActivityAt)}
      </span>
    ),
  },
  {
    id: 'lastIncidentAt',
    accessorFn: (row) => row.lastIncidentAt ?? '',
    header: ({ column }) => (
      <FleetSortableHeader column={column} label="Último incidente" />
    ),
    cell: ({ row }) =>
      row.original.lastIncidentAt ? (
        <div className="max-w-[12rem]">
          <p className="text-sm font-medium text-destructive">
            {row.original.lastIncidentLabel ?? 'Incidente'}
          </p>
          <p className="text-xs text-muted-foreground">
            {formatWhen(row.original.lastIncidentAt)}
          </p>
        </div>
      ) : (
        <span className="text-sm text-muted-foreground">—</span>
      ),
  },
  {
    id: 'actions',
    enableSorting: false,
    header: () => <span className="sr-only">Acciones</span>,
    cell: ({ row }) => (
      <div className="flex justify-end gap-1">{renderActions(row.original)}</div>
    ),
  },
];
