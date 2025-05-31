'use client';

import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface FormattedDateProps {
  date: Date | null;
}

export function FormattedDate({ date }: FormattedDateProps) {
  if (!date) return <span>Sin fecha</span>;
  return <span>{format(new Date(date), 'PPP', { locale: es })}</span>;
}
