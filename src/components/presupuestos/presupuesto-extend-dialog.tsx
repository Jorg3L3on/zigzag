'use client';

import * as React from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { CalendarClock, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { extendPresupuestoVigencia, type PresupuestoListItem } from '@/actions/presupuestos';
import { EXPIRES_AT_QUICK_DAYS } from '@/components/tickets/composer/expires-at-field';
import { Button } from '@/components/ui/button';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { companyDay } from '@/lib/company-day';
import { getErrorDisplayMessage } from '@/lib/network-awareness';
import { companyDaysBetween } from '@/lib/presupuesto-vigencia';
import { cn } from '@/lib/utils';

const toDate = (value: string | Date | null | undefined): Date | null => {
  if (value == null || value === '') return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const DAY_MS = 86_400_000;
/** The furthest a quote can be extended, counted from today (server rule). */
export const EXTEND_MAX_DAYS = 365;

/**
 * Dates here are company days (America/Mexico_City) held as 12:00 UTC, the
 * value companyDay returns: they format as the same day in any browser zone
 * and the server reads them back on the same company day.
 */
const civil = (date: Date): Date => companyDay(date).date;
const plusDays = (date: Date, days: number) => new Date(date.getTime() + days * DAY_MS);
/** A day picked in the calendar (local midnight) as a company day. */
const fromPicker = (date: Date) =>
  new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), 12));
/** A company day as the calendar's local date. */
const toPicker = (date: Date) => new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());

const longDay = (date: Date) => format(civil(date), "d 'de' MMMM", { locale: es });

/**
 * Where +7 / +15 / +30 count from (ZIG-I29-2): today when the quote already
 * expired or has no date, its current expiry otherwise (company days).
 */
export const extendBaseDate = (expiresAt: string | Date | null, now: Date = new Date()): Date => {
  const today = civil(now);
  const expires = toDate(expiresAt);
  if (!expires) return today;
  const current = civil(expires);
  return current < today ? today : current;
};

/** «Nueva vigencia: 1 de noviembre · quedan 7 días». */
export const describeNewVigencia = (value: Date, now: Date = new Date()): string => {
  const days = companyDaysBetween(now, value);
  const left =
    days <= 0 ? 'vence hoy' : `${days === 1 ? 'queda' : 'quedan'} ${days} ${days === 1 ? 'día' : 'días'}`;
  return `Nueva vigencia: ${longDay(value)} · ${left}`;
};

type PresupuestoExtendDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  presupuestoId: string;
  folio?: string | null;
  ticketDate: string | Date | null;
  expiresAt: string | Date | null;
  companyId?: number | null;
  onExtended: (item: PresupuestoListItem | undefined) => void;
};

/**
 * Extender vigencia (ZIG-I29-2): a small form, not a ConfirmSheet. Chips +7 /
 * +15 / +30 días or a date, the new validity before confirming, then the server
 * action. Opened from the Vigencia card, the header ⋯ and the list ⋮.
 */
export const PresupuestoExtendDialog = ({
  open,
  onOpenChange,
  presupuestoId,
  folio = null,
  ticketDate,
  expiresAt,
  companyId = null,
  onExtended,
}: PresupuestoExtendDialogProps) => {
  const [value, setValue] = React.useState<Date | null>(null);
  const [calendarOpen, setCalendarOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const now = new Date();
  const today = civil(now);
  const base = extendBaseDate(expiresAt, now);
  const issued = toDate(ticketDate);
  // Same rule as the server: not before today nor the issue date, at most a year out.
  const minDate = issued && civil(issued) > today ? civil(issued) : today;
  const maxDate = plusDays(today, EXTEND_MAX_DAYS);
  const label = folio || `#${presupuestoId}`;
  const current = toDate(expiresAt);
  const expired = current != null && companyDaysBetween(now, current) < 0;

  React.useEffect(() => {
    if (open) setValue(null);
  }, [open]);

  const handleConfirm = async () => {
    if (!value || pending) return;
    setPending(true);
    try {
      const result = await extendPresupuestoVigencia(Number(presupuestoId), value, companyId);
      if (!result.success) {
        toast.error(getErrorDisplayMessage(result, 'No se pudo extender la vigencia'));
        return;
      }
      toast.success(`Vigencia extendida hasta el ${longDay(value)}`);
      onExtended(result.data);
      onOpenChange(false);
    } catch {
      toast.error('No se pudo extender la vigencia');
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!pending) onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-[420px]" data-testid="presupuesto-extend-dialog">
        <DialogHeader>
          <DialogTitle>Extender vigencia</DialogTitle>
          <DialogDescription>
            Presupuesto {label} ·{' '}
            {current ? `${expired ? 'venció' : 'vence'} el ${longDay(current)}` : 'sin vencimiento'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div role="group" aria-label="Extender por" className="grid grid-cols-3 gap-2">
            {EXPIRES_AT_QUICK_DAYS.map((days) => {
              const option = plusDays(base, days);
              const pressed = value != null && value.getTime() === option.getTime();
              return (
                <Button
                  key={days}
                  type="button"
                  variant="outline"
                  aria-pressed={pressed}
                  className={cn('h-11 rounded-xl', pressed && 'border-primary bg-primary/10 text-foreground')}
                  onClick={() => setValue(option)}
                >
                  +{days} días
                </Button>
              );
            })}
          </div>
          <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                className="h-11 w-full justify-start gap-2 rounded-xl font-normal"
              >
                <CalendarClock className="h-4 w-4 text-muted-foreground" aria-hidden />
                Elegir otra fecha
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <CalendarComponent
                mode="single"
                selected={value ? toPicker(value) : undefined}
                defaultMonth={toPicker(value ?? base)}
                onSelect={(next) => {
                  if (next) setValue(fromPicker(next));
                  setCalendarOpen(false);
                }}
                disabled={(date) => fromPicker(date) < minDate || fromPicker(date) > maxDate}
                initialFocus
              />
            </PopoverContent>
          </Popover>
          <p
            className={cn('text-sm', value ? 'font-medium text-foreground' : 'text-muted-foreground')}
            data-testid="presupuesto-extend-preview"
            aria-live="polite"
          >
            {value
              ? describeNewVigencia(value, now)
              : expired
                ? 'Cuenta desde hoy, porque ya venció.'
                : 'Elige cuántos días más le das.'}
          </p>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            type="button"
            variant="outline"
            className="h-11 rounded-xl"
            disabled={pending}
            onClick={() => onOpenChange(false)}
          >
            Volver
          </Button>
          <Button
            type="button"
            className="h-11 rounded-xl"
            disabled={!value || pending}
            onClick={() => void handleConfirm()}
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
            Extender vigencia
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
