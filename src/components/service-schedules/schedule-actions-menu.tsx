'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  CalendarCheck,
  CalendarClock,
  MessageCircle,
  MoreVertical,
  Pause,
  Pencil,
  Play,
  Plus,
  Trash2,
  UserRound,
} from 'lucide-react';
import type { ClientServiceScheduleListItem } from '@/actions/client-service-schedules';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { formatScheduleShortDate } from '@/lib/schedule-agenda-format';
import {
  computeSnoozedNextDueAt,
  SCHEDULE_SNOOZE_DAY_OPTIONS,
} from '@/lib/schedule-snooze';
import { cn } from '@/lib/utils';

export type ScheduleActionHandlers = {
  onSnoozeDays: (schedule: ClientServiceScheduleListItem, days: number) => void;
  onSnoozePickDate: (schedule: ClientServiceScheduleListItem) => void;
  onMarkDone: (schedule: ClientServiceScheduleListItem) => void;
  onEdit: (schedule: ClientServiceScheduleListItem) => void;
  onPause: (schedule: ClientServiceScheduleListItem) => void;
  onResume: (schedule: ClientServiceScheduleListItem) => void;
  onDelete: (schedule: ClientServiceScheduleListItem) => void;
};

export const createTicketHref = (schedule: ClientServiceScheduleListItem): string =>
  `/tickets/create?clientId=${schedule.clientId}&serviceId=${schedule.serviceId}`;

type ScheduleActionsMenuProps = ScheduleActionHandlers & {
  schedule: ClientServiceScheduleListItem;
  canWrite: boolean;
  canCreateTicket: boolean;
  whatsappHref: string | null;
  /** Hides Crear ticket and WhatsApp when the caller already shows them (the panel). */
  showPrimary?: boolean;
  triggerClassName?: string;
  align?: 'start' | 'end';
};

/**
 * The ⋮ menu of an agenda row and of the side panel (ZIG-I30): everything the
 * row does, Eliminar last after a separator. Paused schedules offer Reanudar
 * instead of Posponer and Marcar como hecho.
 */
export const ScheduleActionsMenu = ({
  schedule,
  canWrite,
  canCreateTicket,
  whatsappHref,
  showPrimary = true,
  triggerClassName,
  align = 'end',
  onSnoozeDays,
  onSnoozePickDate,
  onMarkDone,
  onEdit,
  onPause,
  onResume,
  onDelete,
}: ScheduleActionsMenuProps) => {
  const paused = Boolean(schedule.pausedAt);
  const nextDueAt = new Date(schedule.nextDueAt);
  // Controlled: an item of the Posponer submenu leaves the root menu open otherwise.
  const [open, setOpen] = React.useState(false);
  const run = (action: (schedule: ClientServiceScheduleListItem) => void) => () => {
    setOpen(false);
    action(schedule);
  };

  return (
    <DropdownMenu modal={false} open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn('h-9 w-9 shrink-0', triggerClassName)}
          aria-label={`Acciones del recordatorio de ${schedule.clientName}`}
          onClick={(event) => event.stopPropagation()}
        >
          <MoreVertical className="h-4 w-4" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align={align}
        className="w-60"
        onClick={(event) => event.stopPropagation()}
      >
        {showPrimary && canCreateTicket ? (
          <DropdownMenuItem asChild>
            <Link href={createTicketHref(schedule)}>
              <Plus className="h-4 w-4" aria-hidden />
              Crear ticket
            </Link>
          </DropdownMenuItem>
        ) : null}
        {showPrimary && whatsappHref ? (
          <DropdownMenuItem asChild>
            <a href={whatsappHref} target="_blank" rel="noopener noreferrer">
              <MessageCircle className="h-4 w-4" aria-hidden />
              Recordar por WhatsApp
            </a>
          </DropdownMenuItem>
        ) : null}
        {canWrite && !paused ? (
          <>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <CalendarClock className="h-4 w-4" aria-hidden />
                Posponer
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-56">
                {SCHEDULE_SNOOZE_DAY_OPTIONS.map((days) => (
                  <DropdownMenuItem key={days} onSelect={run((item) => onSnoozeDays(item, days))}>
                    <span className="flex-1">{days} días</span>
                    <span className="text-caption text-muted-foreground">
                      {formatScheduleShortDate(computeSnoozedNextDueAt(nextDueAt, days))}
                    </span>
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={run(onSnoozePickDate)}>
                  Elegir fecha…
                </DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuItem onSelect={run(onMarkDone)}>
              <CalendarCheck className="h-4 w-4" aria-hidden />
              Marcar como hecho
            </DropdownMenuItem>
          </>
        ) : null}
        {canWrite ? (
          <>
            <DropdownMenuItem onSelect={run(onEdit)}>
              <Pencil className="h-4 w-4" aria-hidden />
              Editar
            </DropdownMenuItem>
            {paused ? (
              <DropdownMenuItem onSelect={run(onResume)}>
                <Play className="h-4 w-4" aria-hidden />
                Reanudar
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem onSelect={run(onPause)}>
                <Pause className="h-4 w-4" aria-hidden />
                Pausar
              </DropdownMenuItem>
            )}
          </>
        ) : null}
        <DropdownMenuItem asChild>
          <Link href={`/clients/${schedule.clientId}`}>
            <UserRound className="h-4 w-4" aria-hidden />
            Ver cliente
          </Link>
        </DropdownMenuItem>
        {canWrite ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onSelect={run(onDelete)}
            >
              <Trash2 className="h-4 w-4" aria-hidden />
              Eliminar
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
