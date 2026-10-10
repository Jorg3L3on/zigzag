import { format } from 'date-fns';
import { es } from 'date-fns/locale';

/** "9 de octubre 2026", or null for a missing/invalid ISO date. Server and client safe. */
export const formatLongDate = (value: string | null): string | null => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? null
    : format(date, "d 'de' MMMM yyyy", { locale: es });
};
