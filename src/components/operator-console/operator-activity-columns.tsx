'use client';

import type { ColumnDef } from '@tanstack/react-table';
import Link from 'next/link';
import { ChevronDown } from 'lucide-react';
import { auditResultTone } from '@/components/audit/audit-columns';
import { FormattedDate } from '@/components/formatted-date';
import { ListSortableHeader, ListStatusPill } from '@/components/list-page';
import { actorDisplayName } from '@/lib/audit-actor-display';
import {
  formatAuditActionLabel,
  formatAuditResultLabel,
} from '@/lib/audit-labels';
import {
  formatAuditResourceLabel,
  resolveAuditResourceLink,
} from '@/lib/audit-display';
import type { OperatorActivityRow } from '@/lib/operator-activity';
import {
  isOperatorIncidentEvent,
  operatorIncidentLabel,
} from '@/lib/operator-audit-incidents';
import { cn } from '@/lib/utils';

export type OperatorActivityColumnsOptions = {
  expandedId: number | null;
  showIncidentColumn: boolean;
  tenantCompanyId?: number;
};

/**
 * The desktop activity table (ZIG-I33-8). The row opens its detail (click, Enter,
 * Space), so the first column only shows whether it is open.
 */
export const createOperatorActivityColumns = ({
  expandedId,
  showIncidentColumn,
  tenantCompanyId,
}: OperatorActivityColumnsOptions): ColumnDef<OperatorActivityRow>[] => {
  const columns: ColumnDef<OperatorActivityRow>[] = [
    {
      id: 'expand',
      enableSorting: false,
      meta: { className: 'w-10' },
      header: () => <span className="sr-only">Detalle</span>,
      cell: ({ row }) => (
        <ChevronDown
          className={cn(
            'h-4 w-4 text-muted-foreground transition-transform',
            expandedId === row.original.id && 'rotate-180',
          )}
          aria-hidden
        />
      ),
    },
    {
      id: 'occurred_at',
      accessorKey: 'occurred_at',
      meta: { className: 'w-44' },
      header: ({ column }) => <ListSortableHeader column={column} label="Fecha" />,
      cell: ({ row }) => (
        <div className="tabular-nums text-slate-600 dark:text-slate-300">
          <FormattedDate
            date={new Date(row.original.occurred_at)}
            withTime
          />
          {row.original.count > 1 ? (
            <span className="ml-2 text-caption text-muted-foreground">
              ×{row.original.count}
            </span>
          ) : null}
        </div>
      ),
    },
    {
      id: 'actor',
      meta: { className: 'w-40' },
      accessorFn: (row) =>
        actorDisplayName(row.actor_user_id, row.actor_name),
      header: ({ column }) => <ListSortableHeader column={column} label="Actor" />,
      cell: ({ row }) => (
        <span className="line-clamp-2">
          {actorDisplayName(row.original.actor_user_id, row.original.actor_name)}
        </span>
      ),
    },
    {
      id: 'resource',
      accessorFn: (row) =>
        formatAuditResourceLabel(row.resource_type, row.resource_id, {
          actorName: row.actor_name,
        }),
      header: ({ column }) => (
        <ListSortableHeader column={column} label="Recurso" />
      ),
      cell: ({ row }) => {
        const link = resolveAuditResourceLink(
          row.original.resource_type,
          row.original.resource_id,
          tenantCompanyId != null ? { tenantCompanyId } : undefined,
        );
        const label = formatAuditResourceLabel(
          row.original.resource_type,
          row.original.resource_id,
          { actorName: row.original.actor_name },
        );

        if (!link) {
          return <span className="line-clamp-2">{label}</span>;
        }

        return (
          <Link
            href={link.href}
            className="line-clamp-2 font-medium text-primary underline-offset-4 hover:underline"
            onClick={(event) => event.stopPropagation()}
          >
            {link.label}
          </Link>
        );
      },
    },
    {
      id: 'action',
      accessorKey: 'action',
      meta: { className: 'w-36' },
      header: ({ column }) => <ListSortableHeader column={column} label="Acción" />,
      cell: ({ row }) => formatAuditActionLabel(row.original.action),
    },
    {
      id: 'result',
      accessorKey: 'result',
      meta: { className: 'w-32' },
      header: ({ column }) => (
        <ListSortableHeader column={column} label="Resultado" />
      ),
      cell: ({ row }) => (
        <ListStatusPill tone={auditResultTone(row.original.result)}>
          {formatAuditResultLabel(row.original.result)}
        </ListStatusPill>
      ),
    },
  ];

  if (showIncidentColumn) {
    columns.push({
      id: 'incident',
      meta: { className: 'w-40' },
      accessorFn: (row) =>
        isOperatorIncidentEvent(row) ? operatorIncidentLabel(row) : '',
      header: ({ column }) => (
        <ListSortableHeader column={column} label="Incidente" />
      ),
      cell: ({ row }) => {
        if (!isOperatorIncidentEvent(row.original)) {
          return (
            <span className="text-caption text-muted-foreground">—</span>
          );
        }
        return (
          <ListStatusPill tone="red" className="max-w-full">
            <span className="truncate" title={operatorIncidentLabel(row.original)}>
              {operatorIncidentLabel(row.original)}
            </span>
          </ListStatusPill>
        );
      },
    });
  }

  return columns;
};
