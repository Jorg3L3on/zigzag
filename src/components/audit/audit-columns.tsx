'use client';

import type { ColumnDef } from '@tanstack/react-table';
import Link from 'next/link';
import type { AuditEventListItem } from '@/lib/audit-query';
import { FormattedDate } from '@/components/formatted-date';
import { Badge } from '@/components/ui/badge';
import {
  formatAuditResultLabel,
  formatAuditSourceLabel,
} from '@/lib/audit-catalog';
import { formatAuditEventSummary } from '@/lib/audit-event-summary';
import {
  formatAuditResourceLabel,
  resolveAuditResourceLink,
} from '@/lib/audit-display';

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

const displayName = (name: string | null, fallbackId: string | number | null) =>
  name?.trim() || (fallbackId != null ? String(fallbackId) : '—');

export const createAuditColumns = (): ColumnDef<AuditEventRow>[] => [
  {
    id: 'summary',
    header: 'Resumen',
    cell: ({ row }) => {
      const summary = formatAuditEventSummary(row.original);
      const link = resolveAuditResourceLink(
        row.original.resource_type,
        row.original.resource_id,
      );
      const resourceLabel = formatAuditResourceLabel(
        row.original.resource_type,
        row.original.resource_id,
      );

      return (
        <div className="max-w-md space-y-1">
          <p className="font-medium leading-snug">{summary.title}</p>
          {link ? (
            <Link
              href={link.href}
              className="text-xs text-primary underline-offset-4 hover:underline"
            >
              {link.label}
            </Link>
          ) : (
            <p className="text-xs text-muted-foreground">{resourceLabel}</p>
          )}
        </div>
      );
    },
  },
  {
    accessorKey: 'occurred_at',
    header: 'Cuándo',
    cell: ({ row }) => (
      <FormattedDate date={new Date(row.original.occurred_at)} withTime />
    ),
  },
  {
    accessorKey: 'actor_user_id',
    header: 'Actor',
    cell: ({ row }) =>
      displayName(row.original.actor_user_name, row.original.actor_user_id),
  },
  {
    accessorKey: 'target_company_id',
    header: 'Empresa',
    cell: ({ row }) =>
      displayName(
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
      <Badge variant="outline">{formatAuditSourceLabel(row.original.source)}</Badge>
    ),
  },
];
