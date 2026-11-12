import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { companyDay } from '@/lib/company-day';

/**
 * The list short date as text (ZIG-I33 §6): «8 oct» this year, «12 jun 2025» otherwise,
 * on the company calendar (America/Mexico_City); empty for a missing date. `ListShortDate`
 * renders it in date columns; sentences and toasts («Pospuesto al 8 oct») use it as is.
 */
export const formatListShortDate = (
  value: Date | string | null | undefined,
  now: Date = new Date(),
): string => {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const day = companyDay(date).date;
  const sameYear = day.getUTCFullYear() === companyDay(now).date.getUTCFullYear();
  // companyDay().date is noon UTC: format its UTC fields so the zone of the browser does not move the day.
  const wall = new Date(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate());
  return format(wall, sameYear ? 'd MMM' : 'd MMM yyyy', { locale: es });
};
