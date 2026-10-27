'use client';

import type { ColumnDef } from '@tanstack/react-table';
import type { ReactNode } from 'react';
import {
  ListSortableHeader,
  ListStatusPill,
  type ListStatusTone,
} from '@/components/list-page';
import type { OperatorFleetRow } from '@/lib/company-operator-fleet';

/** Active emerald, suspended red, setup and archived slate (ZIG-I33 §6). */
const LIFECYCLE_TONE: Record<OperatorFleetRow['lifecycle'], ListStatusTone> = {
  ACTIVE: 'emerald',
  SETUP: 'slate',
  SUSPENDED: 'red',
  ARCHIVED: 'slate',
};

export type OperatorFleetColumnsOptions = {
  renderActions: (row: OperatorFleetRow) => ReactNode;
  renderContextBadge: (row: OperatorFleetRow) => ReactNode;
  formatWhen: (iso: string | null) => string;
};

/** The desktop fleet table (ZIG-I33-8): header sort, pills, Seleccionar + ⋯ at the end. */
export const createOperatorFleetColumns = ({
  renderActions,
  renderContextBadge,
  formatWhen,
}: OperatorFleetColumnsOptions): ColumnDef<OperatorFleetRow>[] => [
  {
    id: 'name',
    accessorKey: 'name',
    header: ({ column }) => <ListSortableHeader column={column} label="Empresa" />,
    cell: ({ row }) => (
      <div className="flex min-w-0 flex-col gap-1 py-2">
        <span className="line-clamp-2 font-medium">{row.original.name}</span>
        {renderContextBadge(row.original)}
      </div>
    ),
    sortingFn: (a, b) => a.original.name.localeCompare(b.original.name, 'es'),
  },
  {
    id: 'lifecycle',
    accessorKey: 'lifecycleLabel',
    meta: { className: 'w-36' },
    header: ({ column }) => <ListSortableHeader column={column} label="Estado" />,
    cell: ({ row }) => (
      <ListStatusPill tone={LIFECYCLE_TONE[row.original.lifecycle] ?? 'slate'}>
        {row.original.lifecycleLabel}
      </ListStatusPill>
    ),
  },
  {
    id: 'readiness',
    accessorFn: (row) => row.missingCount,
    meta: { className: 'w-36' },
    header: ({ column }) => <ListSortableHeader column={column} label="Preparación" />,
    cell: ({ row }) =>
      row.original.productionReady ? (
        <ListStatusPill tone="emerald">Lista</ListStatusPill>
      ) : (
        <ListStatusPill tone="amber">
          {row.original.missingCount} pendiente
          {row.original.missingCount === 1 ? '' : 's'}
        </ListStatusPill>
      ),
  },
  {
    id: 'lastActivityAt',
    accessorFn: (row) => row.lastActivityAt ?? '',
    meta: { className: 'w-40' },
    header: ({ column }) => (
      <ListSortableHeader column={column} label="Última actividad" />
    ),
    cell: ({ row }) => (
      <span className="text-muted-foreground">
        {formatWhen(row.original.lastActivityAt)}
      </span>
    ),
  },
  {
    id: 'lastIncidentAt',
    accessorFn: (row) => row.lastIncidentAt ?? '',
    meta: { className: 'hidden w-44 xl:table-cell' },
    header: ({ column }) => (
      <ListSortableHeader column={column} label="Último incidente" />
    ),
    cell: ({ row }) =>
      row.original.lastIncidentAt ? (
        <div className="min-w-0">
          <p className="truncate font-medium text-destructive">
            {row.original.lastIncidentLabel ?? 'Incidente'}
          </p>
          <p className="text-caption text-muted-foreground">
            {formatWhen(row.original.lastIncidentAt)}
          </p>
        </div>
      ) : (
        <span className="text-muted-foreground">—</span>
      ),
  },
  {
    id: 'actions',
    enableSorting: false,
    meta: { className: 'w-40' },
    header: () => <span className="sr-only">Acciones</span>,
    cell: ({ row }) => (
      <div className="flex items-center justify-end gap-1">
        {renderActions(row.original)}
      </div>
    ),
  },
];
