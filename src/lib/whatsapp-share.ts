/**
 * WhatsApp deep-link helpers (client-side `wa.me` only — no Business API).
 */

import {
  buildPaymentInfoLines,
  type CompanyPaymentInfo,
} from '@/lib/company-payment-info';
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

/** Transfer data on its own lines after the message; nothing is added without data. */
const appendPaymentInfo = (
  message: string,
  payment: CompanyPaymentInfo | null | undefined,
): string => {
  const lines = buildPaymentInfoLines(payment);
  return lines.length > 0 ? [message, '', ...lines].join('\n') : message;
};

const documentLabel = (input: { ticketId: string | number | null | undefined; folio?: string | null }): string =>
  input.folio?.trim() || `#${input.ticketId}`;

export type WhatsAppBalanceShareInput = {
  phone: string | null | undefined;
  clientName: string | null | undefined;
  ticketId: string | number;
  /** Company folio (R-0012 / P-0003); falls back to `#id` when absent. */
  folio?: string | null;
  balanceDue: number;
  companyName?: string | null;
  /** Datos para pagar por transferencia (ZIG-I20-1); the text is unchanged without them. */
  payment?: CompanyPaymentInfo | null;
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

  const message = [
    intro,
    `Te recordamos el saldo pendiente del ticket ${documentLabel(input)} a nombre de ${client}: ${balance}.`,
    'Cuando puedas, por favor confirma el pago. ¡Gracias!',
  ].join(' ');
  return appendPaymentInfo(message, input.payment);
};

export const buildWhatsAppBalanceShare = (
  input: WhatsAppBalanceShareInput,
): WhatsAppShareResult | null =>
  buildWhatsAppHref({
    phone: input.phone,
    message: buildWhatsAppBalanceMessage(input),
  });

export type WhatsAppReceiptShareInput = {
  phone: string | null | undefined;
  clientName: string | null | undefined;
  ticketId: string | number;
  /** Company folio (R-0012 / P-0003); falls back to `#id` when absent. */
  folio?: string | null;
  total: number;
  paid: number;
  companyName?: string | null;
  /** Datos para pagar por transferencia (ZIG-I20-1); only appended while a balance is due. */
  payment?: CompanyPaymentInfo | null;
};

export const buildWhatsAppReceiptMessage = (
  input: Omit<WhatsAppReceiptShareInput, 'phone'>,
): string => {
  const client = (input.clientName ?? 'cliente').trim() || 'cliente';
  const company = input.companyName?.trim();
  const intro = company
    ? `Hola, te escribe ${company}.`
    : 'Hola, te escribimos de ZigZag.';
  const balance = Math.max(input.total - input.paid, 0);
  const amounts = [
    `total ${formatTicketListAmount(input.total)}`,
    `pagado ${formatTicketListAmount(input.paid)}`,
  ];
  if (balance > 0) {
    amounts.push(`saldo ${formatTicketListAmount(balance)}`);
  }

  const message = [
    intro,
    `Te compartimos el recibo del ticket ${documentLabel(input)} a nombre de ${client}: ${amounts.join(', ')}.`,
    '¡Gracias!',
  ].join(' ');
  return balance > 0 ? appendPaymentInfo(message, input.payment) : message;
};

export const buildWhatsAppReceiptShare = (
  input: WhatsAppReceiptShareInput,
): WhatsAppShareResult | null =>
  buildWhatsAppHref({
    phone: input.phone,
    message: buildWhatsAppReceiptMessage(input),
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
  /** Company folio (R-0012 / P-0003); falls back to `#id` when absent. */
  folio?: string | null;
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
    `Hoy tenemos programada tu visita (ticket ${documentLabel(input)}) a nombre de ${client}.`,
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

export type WhatsAppQuoteShareInput = {
  phone: string | null | undefined;
  clientName: string | null | undefined;
  ticketId: string | number;
  /** Company folio (R-0012 / P-0003); falls back to `#id` when absent. */
  folio?: string | null;
  total: number;
  servicesSummary?: string | null;
  validUntil?: Date | string | null;
  companyName?: string | null;
};

export const buildWhatsAppQuoteMessage = (
  input: Omit<WhatsAppQuoteShareInput, 'phone'>,
): string => {
  const client = (input.clientName ?? 'cliente').trim() || 'cliente';
  const total = formatTicketListAmount(input.total);
  const company = input.companyName?.trim();
  const intro = company
    ? `Hola, te escribe ${company}.`
    : 'Hola, te escribimos de ZigZag.';
  const services = input.servicesSummary?.trim();
  const servicesPart = services ? ` para ${services}` : '';
  const validUntil = input.validUntil
    ? new Date(input.validUntil)
    : null;
  const validityPart =
    validUntil && !Number.isNaN(validUntil.getTime())
      ? ` Válido hasta el ${validUntil.toLocaleDateString('es-MX', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })}.`
      : '';

  return [
    intro,
    `Te enviamos el presupuesto ${documentLabel(input)} por ${total}${servicesPart}.`,
    `${validityPart} ¿Te confirmamos?`.trim(),
  ]
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
};

export const buildWhatsAppQuoteShare = (
  input: WhatsAppQuoteShareInput,
): WhatsAppShareResult | null =>
  buildWhatsAppHref({
    phone: input.phone,
    message: buildWhatsAppQuoteMessage(input),
  });

/**
 * Recordar por WhatsApp (ZIG-I29-1): the same quote, as a reminder that says
 * when it expires, or that it already did and can be updated.
 */
export const buildWhatsAppQuoteReminderMessage = (
  input: Omit<WhatsAppQuoteShareInput, 'phone'> & { now?: Date },
): string => {
  const total = formatTicketListAmount(input.total);
  const company = input.companyName?.trim();
  const intro = company
    ? `Hola, te escribe ${company}.`
    : 'Hola, te escribimos de ZigZag.';
  const services = input.servicesSummary?.trim();
  const servicesPart = services ? ` para ${services}` : '';
  const validUntil = input.validUntil ? new Date(input.validUntil) : null;
  const now = input.now ?? new Date();
  let validityPart = '¿Te confirmamos?';
  if (validUntil && !Number.isNaN(validUntil.getTime())) {
    const date = validUntil.toLocaleDateString('es-MX', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
    const expired =
      new Date(validUntil).setHours(0, 0, 0, 0) < new Date(now).setHours(0, 0, 0, 0);
    validityPart = expired
      ? `Venció el ${date}; si te sigue interesando, lo actualizamos.`
      : `Es válido hasta el ${date}. ¿Te confirmamos?`;
  }

  return [
    intro,
    `Te recordamos el presupuesto ${documentLabel(input)} por ${total}${servicesPart}.`,
    validityPart,
  ]
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
};

export const buildWhatsAppQuoteReminder = (
  input: WhatsAppQuoteShareInput & { now?: Date },
): WhatsAppShareResult | null =>
  buildWhatsAppHref({
    phone: input.phone,
    message: buildWhatsAppQuoteReminderMessage(input),
  });

export type OfflineReceiptInput = {
  clientName: string | null | undefined;
  ticketId: string | number | null | undefined;
  folio?: string | null;
  localJobId?: string | null;
  workNotesSummary?: string | null;
  total: number;
  paid: number;
  balanceDue: number;
  ticketDate?: Date | string | null;
  companyName?: string | null;
  /** Same payment block as WhatsApp. Omitted lines stay out of the simple receipt. */
  payment?: CompanyPaymentInfo | null;
};

/** Plain-text recibo for offline WhatsApp when branded PDF is unavailable. */
export const buildOfflineReceiptText = (input: OfflineReceiptInput): string => {
  const client = (input.clientName ?? 'cliente').trim() || 'cliente';
  const company = input.companyName?.trim() || 'ZigZag';
  const idLabel = input.ticketId
    ? `Ticket ${documentLabel(input)}`
    : input.localJobId
      ? `Trabajo local (${input.localJobId}) — pendiente de subir`
      : 'Trabajo pendiente de subir';
  const dateValue = input.ticketDate ? new Date(input.ticketDate) : new Date();
  const dateLabel = Number.isNaN(dateValue.getTime())
    ? new Date().toLocaleDateString('es-MX')
    : dateValue.toLocaleDateString('es-MX', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
  const notes = input.workNotesSummary?.trim();

  const lines = [
    `${company} — RECIBO SIMPLE`,
    idLabel,
    `Cliente: ${client}`,
    `Fecha: ${dateLabel}`,
  ];
  if (notes) {
    lines.push(`Trabajo: ${notes}`);
  }
  lines.push(
    `Total: ${formatTicketListAmount(input.total)}`,
    `Pagado: ${formatTicketListAmount(input.paid)}`,
    `Saldo: ${formatTicketListAmount(input.balanceDue)}`,
  );
  const paymentLines = buildPaymentInfoLines(input.payment);
  if (input.balanceDue > 0 && paymentLines.length > 0) {
    lines.push(...paymentLines);
  }
  lines.push('Sin internet — recibo simple. El PDF oficial se envía cuando haya señal.');
  return lines.join('\n');
};

export const buildWhatsAppOfflineReceiptShare = (
  phone: string | null | undefined,
  input: OfflineReceiptInput,
): WhatsAppShareResult | null =>
  buildWhatsAppHref({
    phone,
    message: buildOfflineReceiptText(input),
  });
