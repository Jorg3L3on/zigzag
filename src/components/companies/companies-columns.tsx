'use client';

import type { Company, CompanyLifecycleStatus } from '@/db/schema';
import type { ColumnDef } from '@tanstack/react-table';
import type { ReactNode } from 'react';
import {
  ListSortableHeader,
  ListStatusPill,
  type ListStatusTone,
} from '@/components/list-page';
import { formatCompanyAddressOneLine } from '@/lib/company-address';
import {
  companyLifecycleLabel,
  normalizeCompanyLifecycleStatus,
} from '@/lib/company-lifecycle';

/** Active emerald, setting up amber, suspended slate, archived red (ZIG-I33 §6). */
const LIFECYCLE_TONE: Record<CompanyLifecycleStatus, ListStatusTone> = {
  ACTIVE: 'emerald',
  SETUP: 'amber',
  SUSPENDED: 'slate',
  ARCHIVED: 'red',
};

export type CompaniesColumnsOptions = {
  renderActions: (row: Company) => ReactNode;
  renderContextBadge: (row: Company) => ReactNode;
  /** Width of the actions column: Seleccionar and the ⋯ for operators, else the ⋯. */
  actionsClassName?: string;
};

/** The desktop table of Empresas (ZIG-I33); phones draw cards. */
export const createCompaniesColumns = ({
  renderActions,
  renderContextBadge,
  actionsClassName = 'w-12',
}: CompaniesColumnsOptions): ColumnDef<Company>[] => [
  {
    id: 'name',
    accessorKey: 'name',
    header: ({ column }) => <ListSortableHeader column={column} label="Nombre" />,
    cell: ({ row }) => (
      <span className="line-clamp-2 font-medium">{row.original.name}</span>
    ),
    sortingFn: (a, b) =>
      a.original.name.localeCompare(b.original.name, 'es'),
  },
  {
    id: 'phone',
    accessorKey: 'phone',
    header: ({ column }) => <ListSortableHeader column={column} label="Teléfono" />,
    cell: ({ row }) => (
      <span className="tabular-nums">{row.original.phone}</span>
    ),
    sortingFn: (a, b) =>
      a.original.phone.localeCompare(b.original.phone, 'es', { numeric: true }),
    meta: { className: 'w-36' },
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
    sortingFn: (a, b) =>
      a.original.email.localeCompare(b.original.email, 'es'),
  },
  {
    id: 'address',
    accessorFn: (row) => formatCompanyAddressOneLine(row),
    header: ({ column }) => <ListSortableHeader column={column} label="Dirección" />,
    cell: ({ row }) => (
      <span className="line-clamp-2 text-sm text-muted-foreground">
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
    header: ({ column }) => <ListSortableHeader column={column} label="Estado" />,
    cell: ({ row }) => (
      <ListStatusPill tone={LIFECYCLE_TONE[normalizeCompanyLifecycleStatus(row.original.status)]}>
        {companyLifecycleLabel(row.original.status)}
      </ListStatusPill>
    ),
    sortingFn: (a, b) =>
      a.original.status.localeCompare(b.original.status, 'es'),
    meta: { className: 'w-40' },
  },
  {
    id: 'context',
    enableSorting: false,
    header: 'Empresa',
    cell: ({ row }) => renderContextBadge(row.original),
    meta: { className: 'w-24 text-right' },
  },
  {
    id: 'actions',
    enableSorting: false,
    header: () => <span className="sr-only">Acciones</span>,
    cell: ({ row }) => renderActions(row.original),
    meta: { className: actionsClassName },
  },
];
