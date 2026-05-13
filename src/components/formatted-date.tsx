'use client';

import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface FormattedDateProps {
  date: Date | null;
  /** Incluye hora en formato 24 h (HH:mm:ss). */
  withTime?: boolean;
}

export function FormattedDate({ date, withTime = false }: FormattedDateProps) {
  if (!date) return <span>Sin fecha</span>;
  const pattern = withTime ? "PPP HH:mm:ss" : 'PPP';
  return <span>{format(new Date(date), pattern, { locale: es })}</span>;
}
