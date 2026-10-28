import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { ScheduleDisplayBucket } from '@/lib/schedule-buckets';

/**
 * Words for the agenda (ZIG-I30): short dates on the company calendar and
 * relative days, «hace 12 días», «hoy», «en 5 días», «hace 4 meses».
 */

const plural = (count: number, one: string, many: string): string =>
  `${count} ${count === 1 ? one : many}`;

/** The span of `days` (absolute) in days, then months, then years. */
const spanLabel = (absDays: number): string => {
  if (absDays < 60) return plural(absDays, 'día', 'días');
  if (absDays < 730) return plural(Math.round(absDays / 30.44), 'mes', 'meses');
  return plural(Math.floor(absDays / 365.25), 'año', 'años');
};

/** Calendar days from today: 0 «hoy», 1 «mañana», -1 «ayer», «en …» / «hace …». */
export const formatRelativeDays = (days: number): string => {
  if (days === 0) return 'hoy';
  if (days === 1) return 'mañana';
  if (days === -1) return 'ayer';
  return days > 0 ? `en ${spanLabel(days)}` : `hace ${spanLabel(-days)}`;
};

/** Days since the last service, «hoy», «ayer», «hace 4 meses». */
export const formatDaysSince = (days: number | null): string =>
  days == null ? '' : formatRelativeDays(-days);

export type ScheduleDueTone = 'overdue' | 'soon' | 'muted';

/** Próximo is red when overdue, amber up to DUE_SOON_DAYS, grey otherwise. */
export const scheduleDueTone = (bucket: ScheduleDisplayBucket): ScheduleDueTone =>
  bucket === 'atrasados' ? 'overdue' : bucket === 'proximos' ? 'soon' : 'muted';

export const SCHEDULE_DUE_TONE_CLASS: Record<ScheduleDueTone, string> = {
  overdue: 'text-destructive',
  soon: 'text-amber-700 dark:text-amber-300',
  muted: 'text-muted-foreground',
};

export const SCHEDULE_BUCKET_LABELS: Record<ScheduleDisplayBucket, string> = {
  atrasados: 'Atrasado',
  proximos: 'Próximo',
  programados: 'Programado',
  pausados: 'Pausado',
};

/** «cada 6 meses», «cada mes», «cada 15 días». */
export const formatScheduleEvery = (
  intervalValue: number,
  intervalUnit: 'month' | 'day',
): string => {
  if (intervalUnit === 'day') {
    return intervalValue === 1 ? 'cada día' : `cada ${intervalValue} días`;
  }
  return intervalValue === 1 ? 'cada mes' : `cada ${intervalValue} meses`;
};

/** A `YYYY-MM-DD` civil day as a local-midnight Date, for the date pickers. */
export const isoDayToLocalDate = (iso: string): Date => {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, month - 1, day);
};

/** A date picked in the browser (local midnight) as `YYYY-MM-DD`. */
export const localDateToIsoDay = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate(),
  ).padStart(2, '0')}`;

/** Long form for dialogs: «martes 25 de noviembre de 2026». */
export const formatScheduleLongDate = (iso: string): string =>
  format(isoDayToLocalDate(iso), "EEEE d 'de' MMMM 'de' yyyy", { locale: es });
