'use client';

import * as React from 'react';
import { addDays, differenceInCalendarDays, format, startOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { CalendarClock, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

export const EXPIRES_AT_QUICK_DAYS = [7, 15, 30] as const;

type ExpiresAtFieldProps = {
  value: Date | null;
  onChange: (value: Date | null) => void;
  /** Earliest allowed date (the document date). */
  minDate: Date;
  /** Base for the quick chips; defaults to today. */
  today?: Date;
};

const describeExpiry = (value: Date, today: Date): string => {
  const days = differenceInCalendarDays(value, today);
  const date = format(value, "d 'de' MMMM", { locale: es });
  if (days === 0) return `Vence hoy · ${date}`;
  if (days === 1) return `Vence mañana · ${date}`;
  if (days > 1) return `Vence el ${date} · en ${days} días`;
  return `Venció el ${date}`;
};

/**
 * Optional quote validity (Vence) for Nuevo presupuesto (ZIG-I5-3): quick chips
 * 7 · 15 · 30 días from today, a calendar for any other date, and a clear
 * button back to Sin vencimiento.
 */
export const ExpiresAtField = ({
  value,
  onChange,
  minDate,
  today: todayProp,
}: ExpiresAtFieldProps) => {
  const [open, setOpen] = React.useState(false);
  const today = startOfDay(todayProp ?? new Date());
  const selectedDays = value ? differenceInCalendarDays(value, today) : null;

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <Label htmlFor="composer-expires-at" className="text-sm font-medium">
          Vence <span className="font-normal text-muted-foreground">(opcional)</span>
        </Label>
        {value ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="-my-1 h-8 gap-1 px-2 text-muted-foreground"
            onClick={() => onChange(null)}
          >
            <X className="h-3.5 w-3.5" aria-hidden />
            Sin vencimiento
          </Button>
        ) : null}
      </div>
      <div
        role="group"
        aria-label="Vigencia rápida"
        className="grid grid-cols-3 gap-2"
      >
        {EXPIRES_AT_QUICK_DAYS.map((days) => {
          const pressed = selectedDays === days;
          return (
            <Button
              key={days}
              type="button"
              variant="outline"
              aria-pressed={pressed}
              className={cn(
                'h-10 rounded-xl',
                pressed && 'border-primary bg-primary/10 text-foreground',
              )}
              onClick={() => onChange(addDays(today, days))}
            >
              {days} días
            </Button>
          );
        })}
      </div>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id="composer-expires-at"
            type="button"
            variant="outline"
            className="h-12 w-full justify-start gap-2 rounded-xl text-left text-base font-normal md:h-10 md:text-sm"
          >
            <CalendarClock className="h-4 w-4 text-muted-foreground" aria-hidden />
            {value ? describeExpiry(value, today) : 'Sin vencimiento'}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <CalendarComponent
            mode="single"
            selected={value ?? undefined}
            onSelect={(next) => {
              onChange(next ? startOfDay(next) : null);
              setOpen(false);
            }}
            disabled={(date) => startOfDay(date) < startOfDay(minDate)}
            initialFocus
          />
        </PopoverContent>
      </Popover>
    </div>
  );
};
