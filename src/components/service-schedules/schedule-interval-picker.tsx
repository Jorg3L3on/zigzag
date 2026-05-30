'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  CUSTOM_INTERVAL_PRESET_ID,
  SCHEDULE_INTERVAL_PRESETS,
} from '@/lib/schedule-interval-presets';
import type { ScheduleIntervalUnit } from '@/lib/schedule-date';

type ScheduleIntervalPickerProps = {
  presetId: string;
  intervalValue: number;
  intervalUnit: ScheduleIntervalUnit;
  onPresetIdChange: (presetId: string) => void;
  onIntervalValueChange: (value: number) => void;
  onIntervalUnitChange: (unit: ScheduleIntervalUnit) => void;
  disabled?: boolean;
};

export const ScheduleIntervalPicker = ({
  presetId,
  intervalValue,
  intervalUnit,
  onPresetIdChange,
  onIntervalValueChange,
  onIntervalUnitChange,
  disabled = false,
}: ScheduleIntervalPickerProps) => {
  const isCustom = presetId === CUSTOM_INTERVAL_PRESET_ID;

  const handlePresetChange = (value: string) => {
    onPresetIdChange(value);
    if (value === CUSTOM_INTERVAL_PRESET_ID) {
      return;
    }
    const preset = SCHEDULE_INTERVAL_PRESETS.find((item) => item.id === value);
    if (!preset) {
      return;
    }
    onIntervalValueChange(preset.intervalValue);
    onIntervalUnitChange(preset.intervalUnit);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="space-y-2">
        <Label htmlFor="schedule-interval-preset">Intervalo</Label>
        <Select
          value={presetId}
          onValueChange={handlePresetChange}
          disabled={disabled}
        >
          <SelectTrigger
            id="schedule-interval-preset"
            className="min-h-11 rounded-xl"
            aria-label="Seleccionar intervalo"
          >
            <SelectValue placeholder="Seleccionar intervalo" />
          </SelectTrigger>
          <SelectContent>
            {SCHEDULE_INTERVAL_PRESETS.map((preset) => (
              <SelectItem key={preset.id} value={preset.id}>
                {preset.label}
              </SelectItem>
            ))}
            <SelectItem value={CUSTOM_INTERVAL_PRESET_ID}>
              Personalizado
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isCustom ? (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="schedule-interval-value">Cantidad</Label>
            <Input
              id="schedule-interval-value"
              type="number"
              min={1}
              className="min-h-11 rounded-xl"
              value={intervalValue}
              disabled={disabled}
              onChange={(event) => {
                const parsed = Number.parseInt(event.target.value, 10);
                onIntervalValueChange(Number.isFinite(parsed) ? Math.max(1, parsed) : 1);
              }}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="schedule-interval-unit">Unidad</Label>
            <Select
              value={intervalUnit}
              onValueChange={(value) =>
                onIntervalUnitChange(value as ScheduleIntervalUnit)
              }
              disabled={disabled}
            >
              <SelectTrigger
                id="schedule-interval-unit"
                className="min-h-11 rounded-xl"
                aria-label="Unidad de intervalo"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="month">Meses</SelectItem>
                <SelectItem value="day">Días</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      ) : null}
    </div>
  );
};
