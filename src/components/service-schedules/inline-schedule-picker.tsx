'use client';

import * as React from 'react';

import { ScheduleIntervalPicker } from '@/components/service-schedules/schedule-interval-picker';
import type { TicketFinishScheduleLine } from '@/components/service-schedules/schedule-lines';
import { Checkbox } from '@/components/ui/checkbox';
import {
  CUSTOM_INTERVAL_PRESET_ID,
  formatScheduleInterval,
  SCHEDULE_INTERVAL_PRESETS,
} from '@/lib/schedule-interval-presets';

type InlineSchedulePickerProps = {
  lines: TicketFinishScheduleLine[];
  onChange: (lines: TicketFinishScheduleLine[]) => void;
  disabled?: boolean;
  className?: string;
};

/**
 * "Programar el próximo servicio" on the listo screen (ZIG-I13-3): one checkbox
 * per catalog service with its interval ("en 3 meses"). Tapping the interval
 * opens the preset picker for that line. What is checked is saved when the
 * ticket is finalized, before the receipt is shared.
 */
export const InlineSchedulePicker = ({
  lines,
  onChange,
  disabled = false,
  className,
}: InlineSchedulePickerProps) => {
  const [editing, setEditing] = React.useState<number | null>(null);

  if (lines.length === 0) return null;

  const patchLine = (serviceId: number, patch: Partial<TicketFinishScheduleLine>) =>
    onChange(lines.map((line) => (line.serviceId === serviceId ? { ...line, ...patch } : line)));

  return (
    <section
      aria-labelledby="listo-schedules-heading"
      className={className}
      data-testid="listo-schedules"
    >
      <h2 id="listo-schedules-heading" className="text-[15px] font-semibold">
        Programar el próximo servicio
      </h2>
      <ul className="mt-1">
        {lines.map((line) => {
          const checkboxId = `listo-schedule-${line.serviceId}`;
          return (
            <li key={line.serviceId} className="border-b border-border/50 last:border-b-0">
              <div className="flex min-h-11 items-center gap-3">
                <Checkbox
                  id={checkboxId}
                  checked={line.checked}
                  disabled={disabled}
                  onCheckedChange={(checked) =>
                    patchLine(line.serviceId, { checked: checked === true })
                  }
                />
                <label
                  htmlFor={checkboxId}
                  className="min-w-0 flex-1 py-2 text-sm [overflow-wrap:anywhere]"
                >
                  {line.serviceName}
                </label>
                <button
                  type="button"
                  disabled={disabled || !line.checked}
                  aria-expanded={editing === line.serviceId}
                  aria-label={`Intervalo de ${line.serviceName}: en ${formatScheduleInterval(
                    line.intervalValue,
                    line.intervalUnit,
                  )}`}
                  onClick={() => setEditing(editing === line.serviceId ? null : line.serviceId)}
                  className="shrink-0 rounded-md px-1 py-2 text-[13px] text-muted-foreground underline-offset-4 enabled:hover:underline disabled:no-underline"
                >
                  en {formatScheduleInterval(line.intervalValue, line.intervalUnit)}
                </button>
              </div>
              {editing === line.serviceId && line.checked ? (
                <div className="pb-3 pl-8">
                  <ScheduleIntervalPicker
                    presetId={line.presetId}
                    intervalValue={line.intervalValue}
                    intervalUnit={line.intervalUnit}
                    disabled={disabled}
                    onPresetIdChange={(presetId) => {
                      const patch: Partial<TicketFinishScheduleLine> = { presetId };
                      if (presetId !== CUSTOM_INTERVAL_PRESET_ID) {
                        const preset = SCHEDULE_INTERVAL_PRESETS.find((item) => item.id === presetId);
                        if (preset) {
                          patch.intervalValue = preset.intervalValue;
                          patch.intervalUnit = preset.intervalUnit;
                        }
                      }
                      patchLine(line.serviceId, patch);
                    }}
                    onIntervalValueChange={(intervalValue) => patchLine(line.serviceId, { intervalValue })}
                    onIntervalUnitChange={(intervalUnit) => patchLine(line.serviceId, { intervalUnit })}
                  />
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
};
