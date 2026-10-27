'use client';

import type { ColumnDef } from '@tanstack/react-table';
import type { AuditEventListItem } from '@/lib/audit-query';
import { actorDisplayName } from '@/lib/audit-actor-display';
import {
  formatAuditResultLabel,
  formatAuditSourceLabel,
} from '@/lib/audit-labels';
import { FormattedDate } from '@/components/formatted-date';
import { ListStatusPill, type ListStatusTone } from '@/components/list-page';
import { Badge } from '@/components/ui/badge';
import { AuditSummaryCell } from '@/components/audit/audit-summary-cell';

export type AuditEventRow = AuditEventListItem;

/** OK emerald, denied amber, failed red (ZIG-I33 §6); anything else stays neutral. */
export const auditResultTone = (result: string): ListStatusTone => {
  if (result === 'success') return 'emerald';
  if (result === 'denied') return 'amber';
  if (result === 'failed') return 'red';
  return 'slate';
};

const companyDisplayName = (
  name: string | null,
  fallbackId: number | null,
): string => name?.trim() || (fallbackId != null ? String(fallbackId) : '—');

/**
 * The desktop audit table (ZIG-I33-8). No Detalle column: the row itself opens
 * the event. Empresa and Origen give their room to Resumen below xl.
 */
export const createAuditColumns = (): ColumnDef<AuditEventRow>[] => [
  {
    id: 'summary',
    header: 'Resumen',
    cell: ({ row }) => (
      <AuditSummaryCell event={row.original} className="min-w-0 space-y-0.5 py-2" />
    ),
  },
  {
    accessorKey: 'occurred_at',
    header: 'Cuándo',
    meta: { className: 'w-44' },
    cell: ({ row }) => (
      <span className="tabular-nums text-slate-600 dark:text-slate-300">
        <FormattedDate date={new Date(row.original.occurred_at)} withTime />
      </span>
    ),
  },
  {
    id: 'actor',
    accessorKey: 'actor_name',
    header: 'Actor',
    meta: { className: 'w-40' },
    cell: ({ row }) => (
      <span className="line-clamp-2">
        {actorDisplayName(row.original.actor_user_id, row.original.actor_name)}
      </span>
    ),
  },
  {
    accessorKey: 'target_company_id',
    header: 'Empresa',
    meta: { className: 'hidden w-40 xl:table-cell' },
    cell: ({ row }) => (
      <span className="line-clamp-2">
        {companyDisplayName(
          row.original.target_company_name,
          row.original.target_company_id,
        )}
      </span>
    ),
  },
  {
    accessorKey: 'result',
    header: 'Resultado',
    meta: { className: 'w-32' },
    cell: ({ row }) => (
      <ListStatusPill tone={auditResultTone(row.original.result)}>
        {formatAuditResultLabel(row.original.result)}
      </ListStatusPill>
    ),
  },
  {
    accessorKey: 'source',
    header: 'Origen',
    meta: { className: 'hidden w-28 xl:table-cell' },
    cell: ({ row }) => (
      <Badge variant="outline">
        {formatAuditSourceLabel(row.original.source)}
      </Badge>
    ),
  },
];
