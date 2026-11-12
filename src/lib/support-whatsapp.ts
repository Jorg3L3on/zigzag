import { buildWhatsAppHref } from '@/lib/whatsapp-share';

/**
 * Zigzag has no email, so a forgotten password is solved by a person. The
 * operator configures the support WhatsApp number (`SUPPORT_WHATSAPP_NUMBER`,
 * with country code; a bare 10-digit number is read as Mexico). Unset or
 * unusable means the button is hidden (ZIG-I18-11).
 */
export const buildSupportChatHref = (
  number: string | null | undefined,
  message: string,
): string | null => {
  const digits = (number ?? '').replace(/\D/g, '');
  if (digits.length < 10) return null;
  const withCountry = digits.length === 10 ? `52${digits}` : digits;
  return buildWhatsAppHref({ phone: withCountry, message })?.href ?? null;
};

export const buildSupportWhatsAppHref = (
  number: string | null | undefined,
  login?: string | null,
): string | null => {
  const who = login?.trim() ? ` Mi usuario es ${login.trim()}.` : '';
  return buildSupportChatHref(
    number,
    `Hola, olvidé mi contraseña de Zigzag y no puedo entrar.${who} ¿Me ayudan?`,
  );
};

/** Help centre (ZIG-I40): "Escribir por WhatsApp", hidden when the number is unset. */
export const buildHelpWhatsAppHref = (number: string | null | undefined): string | null =>
  buildSupportChatHref(number, 'Hola, tengo una duda sobre cómo usar ZigZag. ¿Me ayudan?');
