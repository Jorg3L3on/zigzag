/**
 * Datos para pagar por transferencia (ZIG-I20-1): bank, account holder and
 * CLABE stored per company in `Company.settings`, printed on the recibo and
 * appended to the WhatsApp cobranza/recibo messages. Informational text only:
 * the app never takes a payment.
 */

export const CLABE_LENGTH = 18;
export const PAYMENT_BANK_MAX = 40;
export const PAYMENT_HOLDER_MAX = 80;
export const PAYMENT_NOTE_MAX = 120;

/** Digits only; spaces and dashes typed by the user are dropped. */
export const normalizeClabe = (value: string | null | undefined): string =>
  (value ?? '').replace(/[\s-]/g, '');

/**
 * CLABE check digit (Banxico): weights 3, 7, 1 repeating over the first 17
 * digits, the sum modulo 10, and the digit is (10 - remainder) modulo 10.
 */
export const clabeCheckDigit = (first17: string): number => {
  const weights = [3, 7, 1];
  const sum = first17
    .split('')
    .reduce((acc, char, index) => acc + ((Number(char) * weights[index % 3]) % 10), 0);
  return (10 - (sum % 10)) % 10;
};

/** 18 digits whose last digit matches the control digit. */
export const isValidClabe = (value: string | null | undefined): boolean => {
  const clabe = normalizeClabe(value);
  if (!/^\d{18}$/.test(clabe)) return false;
  return clabeCheckDigit(clabe.slice(0, 17)) === Number(clabe[17]);
};

export type CompanyPaymentInfo = {
  bank: string | null;
  holder: string | null;
  clabe: string | null;
  note: string | null;
};

type PaymentSettingsSource = {
  payment_bank?: string | null;
  payment_holder?: string | null;
  payment_clabe?: string | null;
  payment_note?: string | null;
};

const clean = (value: string | null | undefined): string | null => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

/** The company's transfer data, or null when none of the three fields is set. */
export const getCompanyPaymentInfo = (
  settings: PaymentSettingsSource | null | undefined,
): CompanyPaymentInfo | null => {
  if (!settings) return null;
  const info: CompanyPaymentInfo = {
    bank: clean(settings.payment_bank),
    holder: clean(settings.payment_holder),
    clabe: clean(settings.payment_clabe),
    note: clean(settings.payment_note),
  };
  return info.bank || info.holder || info.clabe ? info : null;
};

/** `Banco BBVA · Titular Juan Pérez · CLABE 012345678901234567`, only the parts that exist. */
export const formatPaymentInfoLine = (info: CompanyPaymentInfo): string =>
  [
    info.bank ? `Banco ${info.bank}` : null,
    info.holder ? `Titular ${info.holder}` : null,
    info.clabe ? `CLABE ${info.clabe}` : null,
  ]
    .filter((part): part is string => part !== null)
    .join(' · ');

/** Message lines for WhatsApp: a heading, the data line and the optional note. */
export const buildPaymentInfoLines = (info: CompanyPaymentInfo | null | undefined): string[] => {
  if (!info) return [];
  const line = formatPaymentInfoLine(info);
  if (!line) return [];
  return ['Para pagar por transferencia:', line, ...(info.note ? [info.note] : [])];
};
