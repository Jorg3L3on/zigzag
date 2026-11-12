'use client';

import type { ColumnDef } from '@tanstack/react-table';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { CompanyBrandAvatar } from '@/components/companies/company-brand-avatar';
import { ListSortableHeader, ListStatusPill } from '@/components/list-page';
import type { OperatorFleetRow } from '@/lib/company-operator-fleet';
import {
  formatOnDay,
  formatRelative,
  LIFECYCLE_TONE,
} from '@/lib/operator-console-format';
import { operatorConsoleCompanyHref } from '@/lib/operator-tenant-scope';

export type OperatorFleetColumnsOptions = {
  renderActions: (row: OperatorFleetRow) => ReactNode;
  isContext: (row: OperatorFleetRow) => boolean;
};

const statusSubline = (row: OperatorFleetRow): string | null => {
  if (row.lifecycle === 'SUSPENDED' && row.statusSince) {
    return `desde ${formatOnDay(row.statusSince)}`;
  }
  if (row.lifecycle === 'ARCHIVED' && row.retentionEndsAt) {
    return `datos hasta ${formatOnDay(row.retentionEndsAt)}`;
  }
  return null;
};

/** The line under the attention pill: the reason, said plainly. */
export const attentionLine = (row: OperatorFleetRow): string => {
  const first = row.attention[0];
  if (!first) return '';
  if (first.id === 'missing_profile') {
    return row.profile.missingLabels.join(', ');
  }
  if (first.id === 'alert' && row.alert) {
    return `${row.alert.label} · ${formatRelative(row.alert.at)}`;
  }
  return first.detail;
};

/** Sort key: alerts first, then missing data, ready, unused, then «Al día». */
const attentionRank = (row: OperatorFleetRow): number => {
  const order = ['alert', 'missing_profile', 'ready_to_activate', 'unused'];
  const first = row.attention[0];
  return first ? order.indexOf(first.id) : order.length;
};

/** The desktop fleet table of frame 1 (ZIG-I38-3). */
export const createOperatorFleetColumns = ({
  renderActions,
  isContext,
}: OperatorFleetColumnsOptions): ColumnDef<OperatorFleetRow>[] => [
  {
    id: 'name',
    accessorKey: 'name',
    header: ({ column }) => <ListSortableHeader column={column} label="Empresa" />,
    cell: ({ row }) => {
      const company = row.original;
      const contact = [company.email, company.phone].filter(Boolean).join(' · ');
      return (
        <div className="flex min-w-0 items-center gap-3">
          <CompanyBrandAvatar
            name={company.name}
            logoUrl={company.logo}
            imageSizes="32px"
            className="size-8 shrink-0 rounded-lg text-caption lg:text-xs"
          />
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-2">
              <Link
                href={operatorConsoleCompanyHref(company.id)}
                className="truncate font-medium text-foreground hover:underline"
                title={company.name}
                onClick={(event) => event.stopPropagation()}
              >
                {company.name}
              </Link>
              {isContext(company) ? (
                <span className="shrink-0 rounded-md border border-blue-200 px-1.5 text-caption font-semibold text-blue-700 lg:text-[11px]/[inherit] dark:border-blue-900 dark:text-blue-300">
                  Tu contexto
                </span>
              ) : null}
            </div>
            {contact ? (
              <p className="truncate text-caption text-muted-foreground" title={contact}>
                {contact}
              </p>
            ) : null}
          </div>
        </div>
      );
    },
    sortingFn: (a, b) => a.original.name.localeCompare(b.original.name, 'es'),
  },
  {
    id: 'lifecycle',
    accessorKey: 'lifecycleLabel',
    meta: { className: 'w-40' },
    header: ({ column }) => <ListSortableHeader column={column} label="Estado" />,
    cell: ({ row }) => {
      const sub = statusSubline(row.original);
      return (
        <div className="min-w-0">
          <ListStatusPill tone={LIFECYCLE_TONE[row.original.lifecycle]}>
            {row.original.lifecycleLabel}
          </ListStatusPill>
          {sub ? <p className="mt-0.5 text-caption text-muted-foreground">{sub}</p> : null}
        </div>
      );
    },
  },
  {
    id: 'attention',
    accessorFn: attentionRank,
    meta: { className: 'w-[18rem]' },
    header: ({ column }) => <ListSortableHeader column={column} label="Atención" />,
    cell: ({ row }) => {
      const company = row.original;
      const first = company.attention[0];
      if (!first) {
        return (
          <span className="text-muted-foreground">
            {company.lifecycle === 'ARCHIVED' || company.lifecycle === 'SUSPENDED'
              ? '—'
              : 'Al día'}
          </span>
        );
      }
      const line = attentionLine(company);
      return (
        <div className="min-w-0">
          <ListStatusPill tone={first.tone}>{first.label}</ListStatusPill>
          {line ? (
            <p className="mt-0.5 truncate text-caption text-muted-foreground" title={line}>
              {line}
            </p>
          ) : null}
        </div>
      );
    },
  },
  {
    id: 'people',
    accessorKey: 'peopleCount',
    meta: { align: 'right', className: 'w-24' },
    header: ({ column }) => (
      <ListSortableHeader column={column} label="Personas" align="right" />
    ),
    cell: ({ row }) => <span className="tabular-nums">{row.original.peopleCount}</span>,
  },
  {
    id: 'lastSignInAt',
    accessorFn: (row) => row.lastSignInAt ?? '',
    meta: { className: 'w-36' },
    header: ({ column }) => <ListSortableHeader column={column} label="Último acceso" />,
    cell: ({ row }) => {
      const company = row.original;
      if (company.lifecycle === 'ARCHIVED') {
        return <span className="text-muted-foreground">—</span>;
      }
      const unused = company.attention.some((reason) => reason.id === 'unused');
      return (
        <span
          className={
            unused
              ? 'font-medium text-amber-800 dark:text-amber-300'
              : 'text-slate-700 dark:text-slate-300'
          }
          title={company.lastSignInAt ? new Date(company.lastSignInAt).toLocaleString('es-MX') : undefined}
        >
          {company.lastSignInAt ? formatRelative(company.lastSignInAt) : 'Nunca'}
        </span>
      );
    },
  },
  {
    id: 'actions',
    enableSorting: false,
    meta: { className: 'w-32' },
    header: () => <span className="sr-only">Acciones</span>,
    cell: ({ row }) => (
      <div className="flex items-center justify-end gap-1">{renderActions(row.original)}</div>
    ),
  },
];
