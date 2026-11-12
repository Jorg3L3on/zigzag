'use client';

import * as React from 'react';
import { Loader2 } from 'lucide-react';
import type { ClientServiceScheduleListItem } from '@/actions/client-service-schedules';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { companyDay } from '@/lib/company-day';
import { computeNextDueAt } from '@/lib/schedule-date';
import {
  formatScheduleEvery,
  formatScheduleLongDate,
  isoDayToLocalDate,
  localDateToIsoDay,
} from '@/lib/schedule-agenda-format';

const todayIso = () => companyDay(new Date()).iso;

const DialogSubmit = ({
  busy,
  disabled,
  onClick,
  children,
}: {
  busy: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) => (
  <Button type="button" className="min-h-11 rounded-xl" disabled={busy || disabled} onClick={onClick}>
    {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden data-icon="inline-start" /> : null}
    {children}
  </Button>
);

type BaseDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  busy: boolean;
};

/** Posponer › Elegir fecha… (ZIG-I30): any day from today on. */
export const ScheduleSnoozeDateDialog = ({
  open,
  onOpenChange,
  busy,
  count,
  onConfirm,
}: BaseDialogProps & {
  /** How many schedules move (1 from a row or the panel, N from the selection bar). */
  count: number;
  onConfirm: (until: string) => void;
}) => {
  const [selected, setSelected] = React.useState<Date | undefined>();
  const today = isoDayToLocalDate(todayIso());

  React.useEffect(() => {
    if (open) setSelected(undefined);
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Posponer hasta…</DialogTitle>
          <DialogDescription>
            {count > 1
              ? `Los ${count} recordatorios quedan para el día que elijas.`
              : 'El recordatorio queda para el día que elijas.'}
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-center">
          <Calendar
            mode="single"
            selected={selected}
            onSelect={setSelected}
            disabled={{ before: today }}
            defaultMonth={today}
          />
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            className="min-h-11 rounded-xl"
            onClick={() => onOpenChange(false)}
            disabled={busy}
          >
            Cancelar
          </Button>
          <DialogSubmit
            busy={busy}
            disabled={!selected}
            onClick={() => selected && onConfirm(localDateToIsoDay(selected))}
          >
            Posponer
          </DialogSubmit>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

/**
 * Marcar como hecho (ZIG-I30): the day the service was done (today by default,
 * never in the future nor before the last service) and where the next one lands.
 */
export const ScheduleMarkDoneDialog = ({
  open,
  onOpenChange,
  busy,
  schedule,
  onConfirm,
}: BaseDialogProps & {
  schedule: ClientServiceScheduleListItem | null;
  onConfirm: (doneOn: string) => void;
}) => {
  const [doneOn, setDoneOn] = React.useState(todayIso);

  React.useEffect(() => {
    if (open) setDoneOn(todayIso());
  }, [open]);

  const today = isoDayToLocalDate(todayIso());
  const lastIso = schedule?.lastServiceAt ? companyDay(new Date(schedule.lastServiceAt)).iso : null;
  const nextIso = schedule
    ? companyDay(
        computeNextDueAt(
          new Date(`${doneOn}T12:00:00.000Z`),
          schedule.intervalValue,
          schedule.intervalUnit,
        ),
      ).iso
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl sm:max-w-sm" data-testid="schedule-mark-done-dialog">
        <DialogHeader>
          <DialogTitle>Marcar como hecho</DialogTitle>
          <DialogDescription>
            {schedule ? `${schedule.serviceName} · ${schedule.clientName}` : null}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Label className="text-sm font-medium">¿Cuándo se hizo el servicio?</Label>
          <div className="flex justify-center">
            <Calendar
              mode="single"
              required
              selected={isoDayToLocalDate(doneOn)}
              onSelect={(date) => date && setDoneOn(localDateToIsoDay(date))}
              disabled={[
                { after: today },
                ...(lastIso ? [{ before: isoDayToLocalDate(lastIso) }] : []),
              ]}
              defaultMonth={today}
            />
          </div>
          {schedule && nextIso ? (
            <p className="rounded-xl bg-muted/50 px-3 py-2 text-sm" data-testid="schedule-mark-done-preview">
              El próximo queda para el {formatScheduleLongDate(nextIso)} (
              {formatScheduleEvery(schedule.intervalValue, schedule.intervalUnit)}).
            </p>
          ) : null}
          <p className="text-sm text-muted-foreground">
            Si vas a cobrar el trabajo, mejor crea el ticket: al terminarlo, el recordatorio se
            reprograma solo.
          </p>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            className="min-h-11 rounded-xl"
            onClick={() => onOpenChange(false)}
            disabled={busy}
          >
            Cancelar
          </Button>
          <DialogSubmit busy={busy} onClick={() => onConfirm(doneOn)}>
            Marcar como hecho
          </DialogSubmit>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

/** Pausar (ZIG-I30): an optional reason the panel shows later. */
export const SchedulePauseDialog = ({
  open,
  onOpenChange,
  busy,
  count,
  onConfirm,
}: BaseDialogProps & {
  count: number;
  onConfirm: (reason: string) => void;
}) => {
  const [reason, setReason] = React.useState('');

  React.useEffect(() => {
    if (open) setReason('');
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{count > 1 ? `Pausar ${count} recordatorios` : 'Pausar recordatorio'}</DialogTitle>
          <DialogDescription>
            No aparece en Por atender ni manda avisos hasta que lo reanudes.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="schedule-pause-reason">Motivo (opcional)</Label>
          <Textarea
            id="schedule-pause-reason"
            value={reason}
            maxLength={200}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Ej. El cliente vendió el equipo"
          />
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            className="min-h-11 rounded-xl"
            onClick={() => onOpenChange(false)}
            disabled={busy}
          >
            Cancelar
          </Button>
          <DialogSubmit busy={busy} onClick={() => onConfirm(reason)}>
            Pausar
          </DialogSubmit>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
