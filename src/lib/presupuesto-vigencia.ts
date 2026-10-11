import { differenceInCalendarDays, format } from 'date-fns';
import { es } from 'date-fns/locale';

import type { PresupuestoStatus } from '@/lib/ticket-document-kind';

export type PresupuestoVigencia = {
  /** One line for the total card: "Vence el 9 nov · quedan 30 días". */
  text: string;
  tone: 'ok' | 'soon' | 'expired' | 'none';
};

const shortDate = (date: Date, now: Date): string =>
  format(date, date.getFullYear() === now.getFullYear() ? 'd MMM' : 'd MMM yyyy', { locale: es });

const plural = (count: number, one: string, many: string) =>
  `${count} ${count === 1 ? one : many}`;

/**
 * What the presupuesto detail says about the validity (ZIG-I13-5): the date and
 * the days left, "Vencido" past it, "Sin vencimiento" without one. Days count
 * calendar days, so a quote that expires today still has today.
 */
export const describePresupuestoVigencia = ({
  expiresAt,
  status,
  now = new Date(),
}: {
  expiresAt: string | Date | null;
  status: PresupuestoStatus;
  now?: Date;
}): PresupuestoVigencia => {
  const expires = expiresAt ? new Date(expiresAt) : null;
  if (!expires || Number.isNaN(expires.getTime())) {
    return { text: 'Sin vencimiento', tone: 'none' };
  }
  const date = shortDate(expires, now);
  const daysLeft = differenceInCalendarDays(expires, now);

  if (status === 'vencido' || (status === 'abierto' && daysLeft < 0)) {
    return { text: `Venció el ${date}`, tone: 'expired' };
  }
  if (status === 'convertido' || status === 'cancelado') {
    return { text: `Vencía el ${date}`, tone: 'none' };
  }
  if (daysLeft === 0) return { text: `Vence hoy · ${date}`, tone: 'soon' };
  return {
    text: `Vence el ${date} · ${daysLeft === 1 ? 'queda' : 'quedan'} ${plural(daysLeft, 'día', 'días')}`,
    tone: daysLeft <= 3 ? 'soon' : 'ok',
  };
};
