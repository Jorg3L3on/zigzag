/**
 * WhatsApp deep-link helpers (client-side `wa.me` only — no Business API).
 */

import { normalizePhoneForTel } from '@/lib/phone-links';
import { formatTicketListAmount } from '@/lib/ticket-payment-status';

export type WhatsAppShareInput = {
  phone: string | null | undefined;
  message: string;
};

export type WhatsAppShareResult = {
  href: string;
  message: string;
  digits: string;
};

/** Digits-only (and optional leading +) for wa.me path. */
export const normalizePhoneForWhatsApp = (
  value: string | null | undefined,
): string | null => {
  const normalized = normalizePhoneForTel(value);
  if (!normalized) return null;
  return normalized.replace(/\D/g, '') || null;
};

export const buildWhatsAppHref = (
  input: WhatsAppShareInput,
): WhatsAppShareResult | null => {
  const digits = normalizePhoneForWhatsApp(input.phone);
  if (!digits) return null;

  const message = input.message.trim();
  if (!message) return null;

  const href = `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
  return { href, message, digits };
};

export type WhatsAppBalanceShareInput = {
  phone: string | null | undefined;
  clientName: string | null | undefined;
  ticketId: string | number;
  balanceDue: number;
  companyName?: string | null;
};

export const buildWhatsAppBalanceMessage = (
  input: Omit<WhatsAppBalanceShareInput, 'phone'>,
): string => {
  const client = (input.clientName ?? 'cliente').trim() || 'cliente';
  const balance = formatTicketListAmount(input.balanceDue);
  const company = input.companyName?.trim();
  const intro = company
    ? `Hola, te escribe ${company}.`
    : 'Hola, te escribimos de ZigZag.';

  return [
    intro,
    `Te recordamos el saldo pendiente del ticket #${input.ticketId} a nombre de ${client}: ${balance}.`,
    'Cuando puedas, por favor confirma el pago. ¡Gracias!',
  ].join(' ');
};

export const buildWhatsAppBalanceShare = (
  input: WhatsAppBalanceShareInput,
): WhatsAppShareResult | null =>
  buildWhatsAppHref({
    phone: input.phone,
    message: buildWhatsAppBalanceMessage(input),
  });

export type WhatsAppVisitShareInput = {
  phone: string | null | undefined;
  clientName: string | null | undefined;
  serviceName: string | null | undefined;
  nextDueAt: Date | string;
  companyName?: string | null;
};

export const buildWhatsAppVisitMessage = (
  input: Omit<WhatsAppVisitShareInput, 'phone'>,
): string => {
  const client = (input.clientName ?? 'cliente').trim() || 'cliente';
  const service = (input.serviceName ?? 'servicio').trim() || 'servicio';
  const due = new Date(input.nextDueAt);
  const dueLabel = Number.isNaN(due.getTime())
    ? 'pronto'
    : due.toLocaleDateString('es-MX', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
  const company = input.companyName?.trim();
  const intro = company
    ? `Hola, te escribe ${company}.`
    : 'Hola, te escribimos de ZigZag.';

  return [
    intro,
    `Te recordamos tu próxima visita de ${service} (${client}) programada para el ${dueLabel}.`,
    '¿Te confirma si podemos asistir? ¡Gracias!',
  ].join(' ');
};

export const buildWhatsAppVisitShare = (
  input: WhatsAppVisitShareInput,
): WhatsAppShareResult | null =>
  buildWhatsAppHref({
    phone: input.phone,
    message: buildWhatsAppVisitMessage(input),
  });

export type WhatsAppDayVisitShareInput = {
  phone: string | null | undefined;
  clientName: string | null | undefined;
  ticketId: string | number;
  companyName?: string | null;
};

/** Field “visita de hoy / en camino” message for technician day view. */
export const buildWhatsAppDayVisitMessage = (
  input: Omit<WhatsAppDayVisitShareInput, 'phone'>,
): string => {
  const client = (input.clientName ?? 'cliente').trim() || 'cliente';
  const company = input.companyName?.trim();
  const intro = company
    ? `Hola, te escribe ${company}.`
    : 'Hola, te escribimos de ZigZag.';

  return [
    intro,
    `Hoy tenemos programada tu visita (ticket #${input.ticketId}) a nombre de ${client}.`,
    'Estamos en camino. ¡Gracias!',
  ].join(' ');
};

export const buildWhatsAppDayVisitShare = (
  input: WhatsAppDayVisitShareInput,
): WhatsAppShareResult | null =>
  buildWhatsAppHref({
    phone: input.phone,
    message: buildWhatsAppDayVisitMessage(input),
  });
