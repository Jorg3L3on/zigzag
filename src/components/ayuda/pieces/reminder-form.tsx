'use client';

import { useId, useState } from 'react';
import { AppButton, AppField } from '@/components/ayuda/pieces/app-field';
import { APP_PIECE_CARD, TOUCH_RING_SM } from '@/components/ayuda/pieces/app-look';
import {
  formatScheduleLongDate,
  isoDayToLocalDate,
  localDateToIsoDay,
} from '@/lib/schedule-agenda-format';
import { computeNextDueAt } from '@/lib/schedule-date';

/** Same chips as ScheduleFormDialog (1, 2, 3, 6, 12 meses). */
const CHIPS: Array<{ months: number; label: string }> = [
  { months: 1, label: '1' },
  { months: 2, label: '2' },
  { months: 3, label: '3' },
  { months: 6, label: '6' },
  { months: 12, label: '12 meses' },
];

type ReminderFormPieceProps = {
  client: string;
  service: string;
  lastService: string;
  months: number;
  ring: 'pick' | 'every' | 'save';
};

/**
 * "Nuevo recordatorio" (ScheduleFormDialog). The Cada chips work: picking one
 * reads back the next date with the app's own date math. Nothing is saved.
 */
export const ReminderFormPiece = ({
  client,
  service,
  lastService,
  months: initialMonths,
  ring,
}: ReminderFormPieceProps) => {
  const [months, setMonths] = useState(initialMonths);
  const labelId = useId();
  const last = isoDayToLocalDate(lastService);
  const next = formatScheduleLongDate(localDateToIsoDay(computeNextDueAt(last, months, 'month')));

  return (
    <div className={`${APP_PIECE_CARD} flex flex-col gap-3 p-3.5`}>
      <strong className="text-base font-semibold">Nuevo recordatorio</strong>
      <div aria-hidden className="flex flex-col gap-3">
        <AppField label="Cliente" value={client} ringed={ring === 'pick'} />
        <AppField label="Servicio" value={service} ringed={ring === 'pick'} />
        <AppField label="Último servicio" value={formatScheduleLongDate(lastService)} />
      </div>
      <span id={labelId} className="font-medium">
        Cada
      </span>
      <div
        role="group"
        aria-labelledby={labelId}
        className={`flex flex-wrap gap-2 rounded-full ${ring === 'every' ? TOUCH_RING_SM : ''}`}
      >
        {CHIPS.map((chip) => {
          const pressed = chip.months === months;
          return (
            <button
              key={chip.months}
              type="button"
              aria-pressed={pressed}
              aria-label={`${chip.months} ${chip.months === 1 ? 'mes' : 'meses'}`}
              onClick={() => setMonths(chip.months)}
              className={`min-h-11 min-w-11 cursor-pointer rounded-full border px-3 text-sm ${
                pressed
                  ? 'border-[#2563EB] bg-[#DBEAFE] font-semibold text-[#0B1220]'
                  : 'border-[#E2E8F0] bg-white text-[#556277]'
              }`}
            >
              {chip.label}
            </button>
          );
        })}
      </div>
      <p
        aria-live="polite"
        data-testid="ayuda-reminder-next"
        className="m-0 rounded-[10px] bg-[#F1F5F9] px-3 py-2.5 text-[#334155]"
      >
        Próximo recordatorio: {next}
      </p>
      <span aria-hidden className="flex gap-2.5">
        <AppButton className="flex-1">Cancelar</AppButton>
        <AppButton primary ringed={ring === 'save'} className="flex-1">
          Guardar
        </AppButton>
      </span>
    </div>
  );
};
