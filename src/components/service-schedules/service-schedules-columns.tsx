'use client';

import type { ColumnDef } from '@tanstack/react-table';
import Link from 'next/link';
import { Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { ClientServiceScheduleListItem } from '@/actions/client-service-schedules';
import { FormattedDate } from '@/components/formatted-date';
import { formatScheduleInterval } from '@/lib/schedule-interval-presets';
import { buildTelHref } from '@/lib/phone-links';
import { buildWhatsAppVisitShare } from '@/lib/whatsapp-share';
import { cn } from '@/lib/utils';

type ScheduleRowBucket = Exclude<
  ClientServiceScheduleListItem['bucket'],
  'todos'
>;

const BUCKET_LABELS: Record<ScheduleRowBucket, string> = {
  proximos: 'Próximo',
  atrasados: 'Atrasado',
  programados: 'Programado',
  pausados: 'Pausado',
};

const BUCKET_VARIANT: Record<
  ScheduleRowBucket,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  proximos: 'default',
  atrasados: 'destructive',
  programados: 'outline',
  pausados: 'outline',
};

/** Active (on-track) schedules — green, aligned with ticket payment / service badges */
const BUCKET_BADGE_CLASS: Partial<Record<ScheduleRowBucket, string>> = {
  proximos:
    'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100',
  programados:
    'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100',
};

export type ServiceSchedulesColumnsOptions = {
  canWrite: boolean;
  canCreateTicket: boolean;
  companyName?: string | null;
  onEdit: (schedule: ClientServiceScheduleListItem) => void;
  onPause: (schedule: ClientServiceScheduleListItem) => void;
  onResume: (schedule: ClientServiceScheduleListItem) => void;
  onSnooze: (schedule: ClientServiceScheduleListItem) => void;
  onDelete: (schedule: ClientServiceScheduleListItem) => void;
};

export const createServiceSchedulesColumns = ({
  canWrite,
  canCreateTicket,
  companyName = null,
  onEdit,
  onPause,
  onResume,
  onSnooze,
  onDelete,
}: ServiceSchedulesColumnsOptions): ColumnDef<ClientServiceScheduleListItem>[] => [
  {
    accessorKey: 'clientName',
    header: 'Cliente',
    cell: ({ row }) => (
      <span className="font-medium">{row.original.clientName}</span>
    ),
  },
  {
    accessorKey: 'serviceName',
    header: 'Servicio',
    cell: ({ row }) => row.original.serviceName,
  },
  {
    id: 'interval',
    header: 'Intervalo',
    cell: ({ row }) =>
      formatScheduleInterval(
        row.original.intervalValue,
        row.original.intervalUnit,
      ),
  },
  {
    accessorKey: 'lastServiceAt',
    header: 'Último servicio',
    cell: ({ row }) =>
      row.original.lastServiceAt ? (
        <FormattedDate date={new Date(row.original.lastServiceAt)} />
      ) : (
        '—'
      ),
  },
  {
    accessorKey: 'nextDueAt',
    header: 'Próximo vencimiento',
    cell: ({ row }) => (
      <FormattedDate date={new Date(row.original.nextDueAt)} />
    ),
  },
  {
    id: 'status',
    header: 'Estado',
    cell: ({ row }) => {
      const bucket = row.original.bucket as ScheduleRowBucket;
      return (
        <Badge
          variant={BUCKET_VARIANT[bucket] ?? 'outline'}
          className={cn(BUCKET_BADGE_CLASS[bucket])}
        >
          {BUCKET_LABELS[bucket] ?? row.original.bucket}
        </Badge>
      );
    },
  },
  {
    id: 'actions',
    header: () => <span className="sr-only">Acciones</span>,
    cell: ({ row }) => {
      const schedule = row.original;
      const isPaused = Boolean(schedule.pausedAt);
      const telHref = buildTelHref(schedule.clientPhone);
      const whatsapp = buildWhatsAppVisitShare({
        phone: schedule.clientPhone,
        clientName: schedule.clientName,
        serviceName: schedule.serviceName,
        nextDueAt: schedule.nextDueAt,
        companyName,
      });

      return (
        <div
          className="flex flex-wrap justify-end gap-1"
          onPointerDown={(event) => event.stopPropagation()}
        >
          {telHref ? (
            <Button variant="outline" size="sm" className="rounded-lg" asChild>
              <a href={telHref} aria-label={`Llamar a ${schedule.clientName}`}>
                <Phone className="mr-1 h-3.5 w-3.5" aria-hidden />
                Llamar
              </a>
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-lg"
              disabled
              aria-label="Sin teléfono para llamar"
            >
              Llamar
            </Button>
          )}
          {whatsapp ? (
            <Button variant="outline" size="sm" className="rounded-lg" asChild>
              <a
                href={whatsapp.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`WhatsApp a ${schedule.clientName}`}
              >
                WhatsApp
              </a>
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-lg"
              disabled
              aria-label="Sin teléfono para WhatsApp"
            >
              WhatsApp
            </Button>
          )}
          {canCreateTicket ? (
            <Button variant="outline" size="sm" className="rounded-lg" asChild>
              <Link
                href={`/tickets/create?clientId=${schedule.clientId}&serviceId=${schedule.serviceId}`}
              >
                Crear ticket
              </Link>
            </Button>
          ) : null}
          {canWrite ? (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-lg"
                onClick={() => onEdit(schedule)}
              >
                Editar
              </Button>
              {!isPaused ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-lg"
                  onClick={() => onSnooze(schedule)}
                >
                  Posponer
                </Button>
              ) : null}
              {isPaused ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-lg"
                  onClick={() => onResume(schedule)}
                >
                  Reanudar
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-lg"
                  onClick={() => onPause(schedule)}
                >
                  Pausar
                </Button>
              )}
              <Button
                type="button"
                variant="destructive"
                size="sm"
                className="rounded-lg"
                onClick={() => onDelete(schedule)}
              >
                Eliminar
              </Button>
            </>
          ) : null}
        </div>
      );
    },
  },
];
