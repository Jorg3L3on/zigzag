import {
  differenceInCalendarDays,
  differenceInHours,
  differenceInMinutes,
  isYesterday,
} from 'date-fns';

/**
 * Spanish relative timestamps for activity feeds and timelines.
 * Buckets are intentional product copy (not raw date-fns distance strings).
 */
export const formatRelativeActivityTime = (
  value: Date | string,
  now: Date = new Date(),
): string => {
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const minutes = Math.max(0, differenceInMinutes(now, date));
  if (minutes < 1) {
    return 'Ahora mismo';
  }
  if (minutes < 60) {
    return minutes === 1 ? 'Hace 1 minuto' : `Hace ${minutes} minutos`;
  }

  const hours = differenceInHours(now, date);
  if (hours < 24 && !isYesterday(date)) {
    return hours === 1 ? 'Hace 1 hora' : `Hace ${hours} horas`;
  }

  if (isYesterday(date) || differenceInCalendarDays(now, date) === 1) {
    return 'Ayer';
  }

  const days = differenceInCalendarDays(now, date);
  if (days < 7) {
    return days === 1 ? 'Hace 1 día' : `Hace ${days} días`;
  }
  if (days < 14) {
    return 'La semana pasada';
  }

  return days < 30
    ? `Hace ${Math.floor(days / 7)} semanas`
    : `Hace ${Math.floor(days / 30)} meses`;
};
