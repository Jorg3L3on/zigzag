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

/** «10 de octubre», with the year when it is not this one. */
export const longDate = (date: Date, now: Date = new Date()): string =>
  format(
    date,
    date.getFullYear() === now.getFullYear() ? "d 'de' MMMM" : "d 'de' MMMM 'de' yyyy",
    { locale: es },
  );

const toDate = (value: string | Date | null | undefined): Date | null => {
  if (value == null || value === '') return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const isOpen = (status: PresupuestoStatus) => status === 'abierto' || status === 'vencido';

/**
 * The chip next to the folio on desktop (ZIG-I29-1): «Vence hoy», «Vence en 3
 * días», «Venció hace 2 días». Only an open or expired quote has one.
 */
export const describePresupuestoVigenciaChip = ({
  expiresAt,
  status,
  now = new Date(),
}: {
  expiresAt: string | Date | null;
  status: PresupuestoStatus;
  now?: Date;
}): PresupuestoVigencia | null => {
  if (!isOpen(status)) return null;
  const expires = toDate(expiresAt);
  if (!expires) return { text: 'Sin vencimiento', tone: 'none' };
  const daysLeft = differenceInCalendarDays(expires, now);
  if (daysLeft < 0) {
    const ago = -daysLeft;
    return { text: ago === 1 ? 'Venció ayer' : `Venció hace ${ago} días`, tone: 'expired' };
  }
  if (daysLeft === 0) return { text: 'Vence hoy', tone: 'soon' };
  if (daysLeft === 1) return { text: 'Vence mañana', tone: 'soon' };
  return { text: `Vence en ${daysLeft} días`, tone: daysLeft <= 3 ? 'soon' : 'ok' };
};

export type PresupuestoVigenciaCard = PresupuestoVigencia & {
  /** Days elapsed over the whole validity, 0–1; null without both dates. */
  progress: number | null;
  /** «Emitido el 10 oct». */
  issuedText: string | null;
  /** «Vigencia de 15 días». */
  lengthText: string | null;
};

/**
 * The Vigencia y aceptación card (ZIG-I29-1): «Vence hoy · 25 de octubre»,
 * «Vence el 9 de noviembre · quedan 15 días», «Venció el 25 de octubre · hace
 * 3 días», and the bar of days elapsed since it was issued.
 */
export const describePresupuestoVigenciaCard = ({
  ticketDate,
  expiresAt,
  status,
  now = new Date(),
}: {
  ticketDate: string | Date | null;
  expiresAt: string | Date | null;
  status: PresupuestoStatus;
  now?: Date;
}): PresupuestoVigenciaCard => {
  const issued = toDate(ticketDate);
  const expires = toDate(expiresAt);
  const issuedText = issued ? `Emitido el ${shortDate(issued, now)}` : null;
  if (!expires) {
    return { text: 'Sin vencimiento', tone: 'none', progress: null, issuedText, lengthText: null };
  }
  const length = issued ? Math.max(differenceInCalendarDays(expires, issued), 0) : null;
  const lengthText = length == null ? null : `Vigencia de ${plural(length, 'día', 'días')}`;
  const elapsed = issued ? differenceInCalendarDays(now, issued) : null;
  const progress =
    length == null || elapsed == null
      ? null
      : length === 0
        ? 1
        : Math.min(Math.max(elapsed / length, 0), 1);
  const date = longDate(expires, now);
  const daysLeft = differenceInCalendarDays(expires, now);

  if (!isOpen(status)) {
    return { text: `Vencía el ${date}`, tone: 'none', progress, issuedText, lengthText };
  }
  if (daysLeft < 0) {
    const ago = -daysLeft;
    return {
      text: `Venció el ${date} · ${ago === 1 ? 'ayer' : `hace ${ago} días`}`,
      tone: 'expired',
      progress: 1,
      issuedText,
      lengthText,
    };
  }
  if (daysLeft === 0) {
    return { text: `Vence hoy · ${date}`, tone: 'soon', progress: 1, issuedText, lengthText };
  }
  return {
    text: `Vence el ${date} · ${daysLeft === 1 ? 'queda' : 'quedan'} ${plural(daysLeft, 'día', 'días')}`,
    tone: daysLeft <= 3 ? 'soon' : 'ok',
    progress,
    issuedText,
    lengthText,
  };
};

/** «Vencía el 9 nov» for the Aceptado and Cancelado cards; null without a date. */
export const describePresupuestoPastVigencia = (
  expiresAt: string | Date | null,
  now: Date = new Date(),
): string | null => {
  const expires = toDate(expiresAt);
  return expires ? `vencía el ${shortDate(expires, now)}` : null;
};

export type PresupuestoVenceCell = {
  /** «Vence hoy», «Vence en 3 días», «Venció hace 2 días», «Vencía 9 nov», «Sin vencimiento». */
  text: string;
  /** «25 oct · vigencia de 15 días»; only while open or expired. */
  sub: string | null;
  tone: PresupuestoVigencia['tone'];
};

/**
 * The Vence column of the desktop list (canvas ListaPresuA): how far it is on
 * top, amber within three days and red once past, and the date with the length
 * of the validity under it; grey once accepted or canceled.
 */
export const describePresupuestoVenceCell = ({
  expiresAt,
  status,
  ticketDate = null,
  now = new Date(),
}: {
  expiresAt: string | Date | null;
  status: PresupuestoStatus;
  ticketDate?: string | Date | null;
  now?: Date;
}): PresupuestoVenceCell => {
  const expires = toDate(expiresAt);
  if (!expires) return { text: 'Sin vencimiento', sub: null, tone: 'none' };
  const date = shortDate(expires, now);
  if (!isOpen(status)) return { text: `Vencía ${date}`, sub: null, tone: 'none' };
  const issued = toDate(ticketDate);
  const length = issued ? Math.max(differenceInCalendarDays(expires, issued), 0) : null;
  const sub = length == null ? date : `${date} · vigencia de ${plural(length, 'día', 'días')}`;
  const chip = describePresupuestoVigenciaChip({ expiresAt: expires, status, now });
  return { text: chip?.text ?? date, sub, tone: chip?.tone ?? 'none' };
};
