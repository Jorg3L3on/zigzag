import { differenceInCalendarDays, format } from 'date-fns';
import { es } from 'date-fns/locale';

/**
 * Date of a list row (ZIG-I13-7): "hoy", "ayer", then the weekday and day, `mié 22 oct`
 * (with the year when it is not this one; ZIG-I18-8). Empty for a missing or invalid date.
 */
export const formatListDate = (
  value: Date | string | null | undefined,
  now: Date = new Date(),
): string => {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const days = differenceInCalendarDays(now, date);
  if (days === 0) return 'hoy';
  if (days === 1) return 'ayer';
  return format(date, date.getFullYear() === now.getFullYear() ? 'EEE d MMM' : 'EEE d MMM yyyy', {
    locale: es,
  });
};
