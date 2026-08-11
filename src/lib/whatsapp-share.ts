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
