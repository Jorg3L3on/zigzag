'use client';

import type { ColumnDef } from '@tanstack/react-table';
import Link from 'next/link';
import type { AuditEventListItem } from '@/lib/audit-query';
import { actorDisplayName } from '@/lib/audit-actor-display';
import {
  formatAuditActionLabel,
  formatAuditResultLabel,
} from '@/lib/audit-labels';
import { FormattedDate } from '@/components/formatted-date';
import { Badge } from '@/components/ui/badge';
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
  if (result === 'denied') {
    return 'destructive';
  }
  return 'secondary';
};

export const createAuditColumns = (): ColumnDef<AuditEventRow>[] => [
  {
    accessorKey: 'occurred_at',
    header: 'Cuándo',
    cell: ({ row }) => (
      <FormattedDate
        date={new Date(row.original.occurred_at)}
        withTime
      />
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
    accessorKey: 'actor_company_id',
    header: 'Empresa actor',
    cell: ({ row }) => row.original.actor_company_id ?? '—',
  },
  {
    accessorKey: 'target_company_id',
    header: 'Empresa objetivo',
    cell: ({ row }) => row.original.target_company_id ?? '—',
  },
  {
    id: 'resource',
    header: 'Recurso',
    cell: ({ row }) => {
      const link = resolveAuditResourceLink(
        row.original.resource_type,
        row.original.resource_id,
      );
      const label = formatAuditResourceLabel(
        row.original.resource_type,
        row.original.resource_id,
        { actorName: row.original.actor_name },
      );

      if (!link) {
        return label;
      }

      return (
        <Link
          href={link.href}
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          {link.label}
        </Link>
      );
    },
  },
  {
    accessorKey: 'action',
    header: 'Acción',
    cell: ({ row }) => formatAuditActionLabel(row.original.action),
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
];
