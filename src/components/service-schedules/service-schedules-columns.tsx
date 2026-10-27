'use client';

import type { ColumnDef } from '@tanstack/react-table';
import type { ClientServiceScheduleAgendaItem } from '@/actions/client-service-schedules';
import {
  ListShortDate,
  ListSortableHeader,
  ListStatusPill,
  type ListStatusTone,
} from '@/components/list-page';
import { Checkbox } from '@/components/ui/checkbox';
import {
  ScheduleActionsMenu,
  type ScheduleActionHandlers,
} from '@/components/service-schedules/schedule-actions-menu';
import {
  formatDaysSince,
  formatRelativeDays,
  formatScheduleEvery,
  formatScheduleShortDate,
  SCHEDULE_BUCKET_LABELS,
  SCHEDULE_DUE_TONE_CLASS,
  scheduleDueTone,
} from '@/lib/schedule-agenda-format';
import type { ScheduleDisplayBucket } from '@/lib/schedule-buckets';
import { buildWhatsAppVisitShare } from '@/lib/whatsapp-share';
import { cn } from '@/lib/utils';

export const scheduleWhatsAppHref = (
  schedule: ClientServiceScheduleAgendaItem,
  companyName: string | null,
): string | null =>
  buildWhatsAppVisitShare({
    phone: schedule.clientPhone,
    clientName: schedule.clientName,
    serviceName: schedule.serviceName,
    nextDueAt: schedule.nextDueAt,
    companyName,
  })?.href ?? null;

/** Atrasado red, Próximo amber, Programado emerald (on track), Pausado slate (ZIG-I33 §6). */
const SCHEDULE_BUCKET_TONE: Record<ScheduleDisplayBucket, ListStatusTone> = {
  atrasados: 'red',
  proximos: 'amber',
  programados: 'emerald',
  pausados: 'slate',
};

export const ScheduleBucketPill = ({
  bucket,
  className,
}: {
  bucket: ClientServiceScheduleAgendaItem['bucket'];
  className?: string;
}) => (
  <ListStatusPill tone={SCHEDULE_BUCKET_TONE[bucket]} className={className}>
    {SCHEDULE_BUCKET_LABELS[bucket]}
  </ListStatusPill>
);

/** Próximo: the short date and «hace N días» red / «en N días» amber or grey / «pausado desde …». */
export const ScheduleNextDue = ({ schedule }: { schedule: ClientServiceScheduleAgendaItem }) => (
  <div className="min-w-0 leading-tight">
    <div className="truncate text-sm">
      <ListShortDate date={schedule.nextDueAt} />
    </div>
    {schedule.pausedAt ? (
      <div className="truncate text-caption text-muted-foreground">
        pausado desde {formatScheduleShortDate(schedule.pausedAt)}
      </div>
    ) : (
      <div
        className={cn(
          'truncate text-caption font-medium',
          SCHEDULE_DUE_TONE_CLASS[scheduleDueTone(schedule.bucket)],
        )}
      >
        {formatRelativeDays(schedule.daysUntilDue)}
      </div>
    )}
  </div>
);

export type ServiceSchedulesColumnsOptions = ScheduleActionHandlers & {
  canWrite: boolean;
  canCreateTicket: boolean;
  companyName?: string | null;
};

/**
 * Agenda columns (ZIG-I30, canvas RecA; list standard ZIG-I33-5). Cliente, Servicio,
 * Último servicio and Próximo sort by their header (the column ids map to `?orden`
 * in schedule-agenda-params); the row opens the side panel, so the last column is
 * only the ⋯ menu. Último servicio hides under xl so the table fits at 1024.
 */
export const createServiceSchedulesColumns = ({
  canWrite,
  canCreateTicket,
  companyName = null,
  ...handlers
}: ServiceSchedulesColumnsOptions): ColumnDef<ClientServiceScheduleAgendaItem>[] => [
  ...(canWrite
    ? [
        {
          id: 'select',
          enableSorting: false,
          meta: { className: 'w-11' },
          header: ({ table }) => (
            <Checkbox
              checked={
                table.getIsAllPageRowsSelected()
                  ? true
                  : table.getIsSomePageRowsSelected()
                    ? 'indeterminate'
                    : false
              }
              onCheckedChange={(value) => table.toggleAllPageRowsSelected(Boolean(value))}
              aria-label="Seleccionar los recordatorios de esta página"
            />
          ),
          cell: ({ row }) => (
            <Checkbox
              checked={row.getIsSelected()}
              onCheckedChange={(value) => row.toggleSelected(Boolean(value))}
              onClick={(event) => event.stopPropagation()}
              aria-label={`Seleccionar el recordatorio de ${row.original.clientName}`}
            />
          ),
        } satisfies ColumnDef<ClientServiceScheduleAgendaItem>,
      ]
    : []),
  {
    id: 'client',
    accessorFn: (schedule) => schedule.clientName,
    header: ({ column }) => <ListSortableHeader column={column} label="Cliente" />,
    meta: { className: 'w-[26%]' },
    cell: ({ row }) => {
      const schedule = row.original;
      return (
        <div className="min-w-0 leading-tight">
          <div className="truncate text-sm font-medium" title={schedule.clientName}>
            {schedule.clientName}
          </div>
          <div className="truncate text-caption tabular-nums text-muted-foreground">
            {schedule.clientPhone || 'Sin teléfono'}
          </div>
        </div>
      );
    },
  },
  {
    id: 'service',
    accessorFn: (schedule) => schedule.serviceName,
    header: ({ column }) => <ListSortableHeader column={column} label="Servicio" />,
    meta: { className: 'w-[24%]' },
    cell: ({ row }) => (
      <div className="min-w-0 leading-tight">
        <div className="truncate text-sm" title={row.original.serviceName}>
          {row.original.serviceName}
        </div>
        <div className="truncate text-caption text-muted-foreground">
          {formatScheduleEvery(row.original.intervalValue, row.original.intervalUnit)}
        </div>
      </div>
    ),
  },
  {
    id: 'lastServiceAt',
    accessorFn: (schedule) => schedule.lastServiceAt,
    header: ({ column }) => <ListSortableHeader column={column} label="Último servicio" />,
    meta: { className: 'hidden w-[15%] xl:table-cell' },
    cell: ({ row }) =>
      row.original.lastServiceAt ? (
        <div className="min-w-0 leading-tight">
          <div className="truncate text-sm">
            <ListShortDate date={row.original.lastServiceAt} />
          </div>
          <div className="truncate text-caption text-muted-foreground">
            {formatDaysSince(row.original.daysSinceLast)}
          </div>
        </div>
      ) : (
        <span className="text-muted-foreground">—</span>
      ),
  },
  {
    id: 'nextDueAt',
    accessorFn: (schedule) => schedule.nextDueAt,
    header: ({ column }) => <ListSortableHeader column={column} label="Próximo" />,
    meta: { className: 'w-[15%]' },
    cell: ({ row }) => <ScheduleNextDue schedule={row.original} />,
  },
  {
    id: 'status',
    header: 'Estado',
    enableSorting: false,
    meta: { className: 'w-[13%]' },
    cell: ({ row }) => <ScheduleBucketPill bucket={row.original.bucket} />,
  },
  {
    id: 'actions',
    enableSorting: false,
    header: () => <span className="sr-only">Acciones</span>,
    // The 32 px ⋯ plus the cell padding (12 + 16).
    meta: { className: 'w-[3.75rem]' },
    cell: ({ row }) => (
      <div className="flex justify-end">
        <ScheduleActionsMenu
          schedule={row.original}
          canWrite={canWrite}
          canCreateTicket={canCreateTicket}
          whatsappHref={scheduleWhatsAppHref(row.original, companyName)}
          {...handlers}
        />
      </div>
    ),
  },
];
