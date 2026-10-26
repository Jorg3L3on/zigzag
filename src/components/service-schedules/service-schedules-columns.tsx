'use client';

import type { ColumnDef } from '@tanstack/react-table';
import Link from 'next/link';
import type { ClientServiceScheduleAgendaItem } from '@/actions/client-service-schedules';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  createTicketHref,
  ScheduleActionsMenu,
  type ScheduleActionHandlers,
} from '@/components/service-schedules/schedule-actions-menu';
import {
  formatDaysSince,
  formatRelativeDays,
  formatScheduleEvery,
  formatScheduleShortDate,
  SCHEDULE_BUCKET_LABELS,
  SCHEDULE_BUCKET_PILL_CLASS,
  SCHEDULE_DUE_TONE_CLASS,
  scheduleDueTone,
} from '@/lib/schedule-agenda-format';
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

export const ScheduleStatusPill = ({
  bucket,
  className,
}: {
  bucket: ClientServiceScheduleAgendaItem['bucket'];
  className?: string;
}) => (
  <span
    className={cn(
      'inline-flex items-center whitespace-nowrap rounded-full border px-2.5 py-0.5 text-caption font-medium',
      SCHEDULE_BUCKET_PILL_CLASS[bucket],
      className,
    )}
  >
    {SCHEDULE_BUCKET_LABELS[bucket]}
  </span>
);

/** Próximo: the short date and «hace N días» red / «en N días» amber or grey / «pausado desde …». */
export const ScheduleNextDue = ({ schedule }: { schedule: ClientServiceScheduleAgendaItem }) => (
  <div className="min-w-0 leading-tight">
    <div className="truncate text-sm tabular-nums">{formatScheduleShortDate(schedule.nextDueAt)}</div>
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
  onOpen: (schedule: ClientServiceScheduleAgendaItem) => void;
};

/** Agenda columns (ZIG-I30, canvas RecA). Último servicio hides under xl so ⋮ fits at 1024. */
export const createServiceSchedulesColumns = ({
  canWrite,
  canCreateTicket,
  companyName = null,
  onOpen,
  ...handlers
}: ServiceSchedulesColumnsOptions): ColumnDef<ClientServiceScheduleAgendaItem>[] => [
  ...(canWrite
    ? [
        {
          id: 'select',
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
    header: 'Cliente',
    meta: { className: 'w-[24%]' },
    cell: ({ row }) => {
      const schedule = row.original;
      return (
        <div className="min-w-0 leading-tight">
          <button
            type="button"
            className="block max-w-full truncate rounded-sm text-left text-sm font-medium outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
            title={schedule.clientName}
            onClick={(event) => {
              event.stopPropagation();
              onOpen(schedule);
            }}
          >
            {schedule.clientName}
          </button>
          <div className="truncate text-caption tabular-nums text-muted-foreground">
            {schedule.clientPhone || 'Sin teléfono'}
          </div>
        </div>
      );
    },
  },
  {
    id: 'service',
    header: 'Servicio',
    meta: { className: 'w-[22%]' },
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
    header: 'Último servicio',
    meta: { className: 'hidden w-[14%] xl:table-cell' },
    cell: ({ row }) =>
      row.original.lastServiceAt ? (
        <div className="min-w-0 leading-tight">
          <div className="truncate text-sm tabular-nums">
            {formatScheduleShortDate(row.original.lastServiceAt)}
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
    header: 'Próximo',
    meta: { className: 'w-[14%]' },
    cell: ({ row }) => <ScheduleNextDue schedule={row.original} />,
  },
  {
    id: 'status',
    header: 'Estado',
    meta: { className: 'w-[12%]' },
    cell: ({ row }) => <ScheduleStatusPill bucket={row.original.bucket} />,
  },
  {
    id: 'actions',
    header: () => <span className="sr-only">Acciones</span>,
    meta: { className: 'w-[248px] text-right' },
    cell: ({ row }) => {
      const schedule = row.original;
      const whatsappHref = scheduleWhatsAppHref(schedule, companyName);
      return (
        <div className="flex items-center justify-end" onClick={(event) => event.stopPropagation()}>
          <div className="grid grid-cols-[0fr] group-hover:grid-cols-[1fr] group-focus-within:grid-cols-[1fr]">
            <div className="flex min-w-0 items-center gap-1 overflow-hidden opacity-0 group-hover:overflow-visible group-hover:opacity-100 group-focus-within:overflow-visible group-focus-within:opacity-100">
              {canCreateTicket ? (
                <Button asChild variant="outline" size="sm">
                  <Link
                    href={createTicketHref(schedule)}
                    aria-label={`Crear ticket para ${schedule.clientName}`}
                  >
                    Crear ticket
                  </Link>
                </Button>
              ) : null}
              {whatsappHref ? (
                <Button asChild variant="outline" size="sm">
                  <a
                    href={whatsappHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Recordar por WhatsApp a ${schedule.clientName}`}
                  >
                    WhatsApp
                  </a>
                </Button>
              ) : null}
            </div>
          </div>
          <ScheduleActionsMenu
            schedule={schedule}
            canWrite={canWrite}
            canCreateTicket={canCreateTicket}
            whatsappHref={whatsappHref}
            {...handlers}
          />
        </div>
      );
    },
  },
];
