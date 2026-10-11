import { buildWhatsAppHref } from '@/lib/whatsapp-share';

/**
 * Zigzag has no email, so a forgotten password is solved by a person. The
 * operator configures the support WhatsApp number (`SUPPORT_WHATSAPP_NUMBER`,
 * with country code; a bare 10-digit number is read as Mexico). Unset or
 * unusable means the button is hidden (ZIG-I18-11).
 */
export const buildSupportWhatsAppHref = (
  number: string | null | undefined,
  login?: string | null,
): string | null => {
  const digits = (number ?? '').replace(/\D/g, '');
  if (digits.length < 10) return null;
  const withCountry = digits.length === 10 ? `52${digits}` : digits;
  const who = login?.trim() ? ` Mi usuario es ${login.trim()}.` : '';
  const result = buildWhatsAppHref({
    phone: withCountry,
    message: `Hola, olvidé mi contraseña de Zigzag y no puedo entrar.${who} ¿Me ayudan?`,
  });
  return result?.href ?? null;
};
