'use client';

import type { ColumnDef } from '@tanstack/react-table';
import type { AuditEventListItem } from '@/lib/audit-query';
import { actorDisplayName } from '@/lib/audit-actor-display';
import {
  formatAuditResultLabel,
  formatAuditSourceLabel,
} from '@/lib/audit-labels';
import { FormattedDate } from '@/components/formatted-date';
import { Badge } from '@/components/ui/badge';
import { AuditSummaryCell } from '@/components/audit/audit-summary-cell';

export type AuditEventRow = AuditEventListItem;

const resultVariant = (
  result: string,
): 'default' | 'secondary' | 'destructive' | 'outline' => {
  if (result === 'success') {
    return 'default';
  }
  if (result === 'denied' || result === 'failed') {
    return 'destructive';
  }
  return 'secondary';
};

const companyDisplayName = (
  name: string | null,
  fallbackId: number | null,
): string => name?.trim() || (fallbackId != null ? String(fallbackId) : '—');

export const createAuditColumns = (): ColumnDef<AuditEventRow>[] => [
  {
    id: 'summary',
    header: 'Resumen',
    cell: ({ row }) => <AuditSummaryCell event={row.original} />,
  },
  {
    accessorKey: 'occurred_at',
    header: 'Cuándo',
    cell: ({ row }) => (
      <FormattedDate date={new Date(row.original.occurred_at)} withTime />
    ),
  },
  {
    id: 'actor',
    accessorKey: 'actor_name',
    header: 'Actor',
    cell: ({ row }) =>
      actorDisplayName(row.original.actor_user_id, row.original.actor_name),
  },
  {
    accessorKey: 'target_company_id',
    header: 'Empresa',
    cell: ({ row }) =>
      companyDisplayName(
        row.original.target_company_name,
        row.original.target_company_id,
      ),
  },
  {
    accessorKey: 'result',
    header: 'Resultado',
    cell: ({ row }) => (
      <Badge variant={resultVariant(row.original.result)}>
        {formatAuditResultLabel(row.original.result)}
      </Badge>
    ),
  },
  {
    accessorKey: 'source',
    header: 'Origen',
    cell: ({ row }) => (
      <Badge variant="outline">
        {formatAuditSourceLabel(row.original.source)}
      </Badge>
    ),
  },
];
