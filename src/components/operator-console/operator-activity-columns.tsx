'use client';

import type { Column, ColumnDef } from '@tanstack/react-table';
import Link from 'next/link';
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronDown } from 'lucide-react';
import { FormattedDate } from '@/components/formatted-date';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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

const SortableHeader = <TData,>({
  column,
  label,
}: {
  column: Column<TData>;
  label: string;
}) => {
  const sorted = column.getIsSorted();

  return (
    <Button
      type="button"
      variant="ghost"
      className="-ml-2 h-7 max-w-full px-2 text-sm font-medium hover:bg-transparent"
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
        <ArrowUpDown className="ml-2 h-4 w-4 shrink-0 opacity-60" aria-hidden />
      )}
    </Button>
  );
};

export type OperatorActivityColumnsOptions = {
  expandedId: number | null;
  onToggleExpand: (eventId: number) => void;
  showIncidentColumn: boolean;
  tenantCompanyId?: number;
};

export const createOperatorActivityColumns = ({
  expandedId,
  onToggleExpand,
  showIncidentColumn,
  tenantCompanyId,
}: OperatorActivityColumnsOptions): ColumnDef<OperatorActivityRow>[] => {
  const columns: ColumnDef<OperatorActivityRow>[] = [
    {
      id: 'expand',
      enableSorting: false,
      header: () => <span className="sr-only">Detalle</span>,
      cell: ({ row }) => {
        const expanded = expandedId === row.original.id;
        return (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            aria-expanded={expanded}
            aria-label={`Ver detalle del evento ${row.original.id}`}
            onClick={(event) => {
              event.stopPropagation();
              onToggleExpand(row.original.id);
            }}
          >
            <ChevronDown
              className={cn(
                'h-4 w-4 text-muted-foreground transition-transform',
                expanded && 'rotate-180',
              )}
              aria-hidden
            />
          </Button>
        );
      },
    },
    {
      id: 'occurred_at',
      accessorKey: 'occurred_at',
      header: ({ column }) => <SortableHeader column={column} label="Fecha" />,
      cell: ({ row }) => (
        <div className="whitespace-nowrap text-sm">
          <FormattedDate
            date={new Date(row.original.occurred_at)}
            withTime
          />
          {row.original.count > 1 ? (
            <span className="ml-2 text-xs text-muted-foreground">
              ×{row.original.count}
            </span>
          ) : null}
        </div>
      ),
    },
    {
      id: 'actor',
      accessorFn: (row) =>
        actorDisplayName(row.actor_user_id, row.actor_name),
      header: ({ column }) => <SortableHeader column={column} label="Actor" />,
      cell: ({ row }) => (
        <span className="text-sm">
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
        <SortableHeader column={column} label="Recurso" />
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
          return <span className="text-sm">{label}</span>;
        }

        return (
          <Link
            href={link.href}
            className="text-sm font-medium text-primary underline-offset-4 hover:underline"
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
      header: ({ column }) => <SortableHeader column={column} label="Acción" />,
      cell: ({ row }) => formatAuditActionLabel(row.original.action),
    },
    {
      id: 'result',
      accessorKey: 'result',
      header: ({ column }) => (
        <SortableHeader column={column} label="Resultado" />
      ),
      cell: ({ row }) => (
        <Badge
          variant={
            row.original.result === 'success' ? 'default' : 'destructive'
          }
        >
          {formatAuditResultLabel(row.original.result)}
        </Badge>
      ),
    },
  ];

  if (showIncidentColumn) {
    columns.push({
      id: 'incident',
      accessorFn: (row) =>
        isOperatorIncidentEvent(row) ? operatorIncidentLabel(row) : '',
      header: ({ column }) => (
        <SortableHeader column={column} label="Incidente" />
      ),
      cell: ({ row }) => {
        if (!isOperatorIncidentEvent(row.original)) {
          return (
            <span className="text-xs text-muted-foreground">—</span>
          );
        }
        return (
          <Badge variant="destructive">
            {operatorIncidentLabel(row.original)}
          </Badge>
        );
      },
    });
  }

  return columns;
};
