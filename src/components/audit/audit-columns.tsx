'use client';

import type { ColumnDef } from '@tanstack/react-table';
import type { AuditEventListItem } from '@/lib/audit-query';
import { FormattedDate } from '@/components/formatted-date';
import { Badge } from '@/components/ui/badge';

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
    accessorKey: 'actor_user_id',
    header: 'Actor',
    cell: ({ row }) => row.original.actor_user_id ?? '—',
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
    cell: ({ row }) =>
      `${row.original.resource_type}${row.original.resource_id ? `#${row.original.resource_id}` : ''}`,
  },
  {
    accessorKey: 'action',
    header: 'Acción',
  },
  {
    accessorKey: 'result',
    header: 'Resultado',
    cell: ({ row }) => (
      <Badge variant={resultVariant(row.original.result)}>
        {row.original.result}
      </Badge>
    ),
  },
];
