import type { ScheduleIntervalUnit } from '@/lib/schedule-date';

export type ScheduleIntervalPreset = {
  id: string;
  label: string;
  intervalValue: number;
  intervalUnit: ScheduleIntervalUnit;
};

export const SCHEDULE_INTERVAL_PRESETS: ScheduleIntervalPreset[] = [
  { id: '1m', label: '1 mes', intervalValue: 1, intervalUnit: 'month' },
  { id: '2m', label: '2 meses', intervalValue: 2, intervalUnit: 'month' },
  { id: '3m', label: '3 meses', intervalValue: 3, intervalUnit: 'month' },
  { id: '6m', label: '6 meses', intervalValue: 6, intervalUnit: 'month' },
  { id: '12m', label: '12 meses', intervalValue: 12, intervalUnit: 'month' },
  { id: '1y', label: '1 año', intervalValue: 12, intervalUnit: 'month' },
];

export const CUSTOM_INTERVAL_PRESET_ID = 'custom';

export const formatScheduleInterval = (
  intervalValue: number,
  intervalUnit: ScheduleIntervalUnit,
): string => {
  if (intervalUnit === 'day') {
    return intervalValue === 1 ? '1 día' : `${intervalValue} días`;
  }
  return intervalValue === 1 ? '1 mes' : `${intervalValue} meses`;
};

export const findMatchingPresetId = (
  intervalValue: number,
  intervalUnit: ScheduleIntervalUnit,
): string => {
  const match = SCHEDULE_INTERVAL_PRESETS.find(
    (preset) =>
      preset.intervalValue === intervalValue &&
      preset.intervalUnit === intervalUnit,
  );
  return match?.id ?? CUSTOM_INTERVAL_PRESET_ID;
};
