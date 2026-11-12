/**
 * Datos para pagar (ZIG-I20-1, ZIG-23): one method per company — CLABE, card
 * number or account number — stored in `Company.settings`. Printed on the
 * ticket recibo and appended to WhatsApp. Informational text only: the app
 * never takes a payment, and a card never asks for expiry or CVV.
 *
 * Without `payment_kind` the company stays CLABE and the printed line is the
 * historical ungrouped string, so existing recibos and WhatsApp messages do
 * not change.
 */

export const CLABE_LENGTH = 18;
export const CARD_MIN_LENGTH = 15;
export const CARD_MAX_LENGTH = 19;
export const ACCOUNT_MIN_LENGTH = 10;
export const ACCOUNT_MAX_LENGTH = 11;
export const PAYMENT_BANK_MAX = 40;
export const PAYMENT_HOLDER_MAX = 80;
export const PAYMENT_NOTE_MAX = 120;

export const PAYMENT_KINDS = ['clabe', 'card', 'account'] as const;
export type PaymentKind = (typeof PAYMENT_KINDS)[number];

export const PAYMENT_KIND_LABEL: Record<PaymentKind, string> = {
  clabe: 'CLABE',
  card: 'Tarjeta',
  account: 'Cuenta',
};

/** CONDUSEF recommends CLABE. Shown when the company picks a card number. */
export const CARD_PAYMENT_WARNING =
  'La CONDUSEF recomienda cobrar con CLABE, no con el número de tarjeta. No pedimos vencimiento ni CVV: sólo el número para que te depositen.';

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

/** Luhn check. Used for card numbers (15–19 digits). */
export const isValidLuhn = (digits: string): boolean => {
  if (!/^\d+$/.test(digits)) return false;
  let sum = 0;
  let doubleDigit = false;
  for (let index = digits.length - 1; index >= 0; index -= 1) {
    let current = Number(digits[index]);
    if (doubleDigit) {
      current *= 2;
      if (current > 9) current -= 9;
    }
    sum += current;
    doubleDigit = !doubleDigit;
  }
  return sum % 10 === 0;
};

export const isValidCardNumber = (value: string | null | undefined): boolean => {
  const digits = normalizeClabe(value);
  if (digits.length < CARD_MIN_LENGTH || digits.length > CARD_MAX_LENGTH) return false;
  return isValidLuhn(digits);
};

export const isValidAccountNumber = (value: string | null | undefined): boolean => {
  const digits = normalizeClabe(value);
  return digits.length >= ACCOUNT_MIN_LENGTH && digits.length <= ACCOUNT_MAX_LENGTH;
};

export const isPaymentKind = (value: string | null | undefined): value is PaymentKind =>
  value === 'clabe' || value === 'card' || value === 'account';

/** Missing or unknown kind is CLABE, so companies saved before ZIG-23 stay put. */
export const resolvePaymentKind = (
  value: string | null | undefined,
): PaymentKind => (isPaymentKind(value) ? value : 'clabe');

const groupChunks = (digits: string, size: number): string => {
  const parts: string[] = [];
  for (let index = 0; index < digits.length; index += size) {
    parts.push(digits.slice(index, index + size));
  }
  return parts.join(' ');
};

/** CLABE `3-3-11-1`. A short value keeps the digits it has. */
export const formatClabeGroups = (digits: string): string => {
  const sizes = [3, 3, 11, 1];
  const parts: string[] = [];
  let index = 0;
  for (const size of sizes) {
    if (index >= digits.length) break;
    parts.push(digits.slice(index, index + size));
    index += size;
  }
  if (index < digits.length) parts.push(digits.slice(index));
  return parts.join(' ');
};

/** Card numbers print in groups of 4 (`4-4-4-4`, remainder on the last group). */
export const formatCardGroups = (digits: string): string => groupChunks(digits, 4);

/** Account numbers print in groups of 4. */
export const formatAccountGroups = (digits: string): string => groupChunks(digits, 4);

export type CompanyPaymentInfo = {
  bank: string | null;
  holder: string | null;
  /** Digits of the active method. The field name stays `clabe` for recibos saved before ZIG-23. */
  clabe: string | null;
  note: string | null;
  /**
   * Set only when `settings.payment_kind` is present. Absent means the legacy
   * CLABE line (ungrouped digits, heading "Para pagar por transferencia").
   */
  kind?: PaymentKind;
};

type PaymentSettingsSource = {
  payment_bank?: string | null;
  payment_holder?: string | null;
  payment_clabe?: string | null;
  payment_card?: string | null;
  payment_account?: string | null;
  payment_note?: string | null;
  payment_kind?: string | null;
};

const clean = (value: string | null | undefined): string | null => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

const digitsForKind = (
  settings: PaymentSettingsSource,
  kind: PaymentKind,
): string | null => {
  if (kind === 'card') return clean(normalizeClabe(settings.payment_card));
  if (kind === 'account') return clean(normalizeClabe(settings.payment_account));
  return clean(normalizeClabe(settings.payment_clabe));
};

/** The company's payment data, or null when bank, holder and the number are all empty. */
export const getCompanyPaymentInfo = (
  settings: PaymentSettingsSource | null | undefined,
): CompanyPaymentInfo | null => {
  if (!settings) return null;
  const explicit = isPaymentKind(settings.payment_kind);
  const kind = resolvePaymentKind(settings.payment_kind);
  const info: CompanyPaymentInfo = {
    bank: clean(settings.payment_bank),
    holder: clean(settings.payment_holder),
    clabe: explicit ? digitsForKind(settings, kind) : clean(normalizeClabe(settings.payment_clabe)),
    note: clean(settings.payment_note),
    ...(explicit ? { kind } : {}),
  };
  return info.bank || info.holder || info.clabe ? info : null;
};

const numberPart = (info: CompanyPaymentInfo): string | null => {
  if (!info.clabe) return null;
  if (info.kind === 'card') return `Tarjeta ${formatCardGroups(info.clabe)}`;
  if (info.kind === 'account') return `Cuenta ${formatAccountGroups(info.clabe)}`;
  if (info.kind === 'clabe') return `CLABE ${formatClabeGroups(info.clabe)}`;
  return `CLABE ${info.clabe}`;
};

/** `Banco BBVA · Titular Juan Pérez · CLABE 012345678901234567`, only the parts that exist. */
export const formatPaymentInfoLine = (info: CompanyPaymentInfo): string =>
  [
    info.bank ? `Banco ${info.bank}` : null,
    info.holder ? `Titular ${info.holder}` : null,
    numberPart(info),
  ]
    .filter((part): part is string => part !== null)
    .join(' · ');

const paymentHeading = (info: CompanyPaymentInfo): string => {
  if (info.kind === 'card') return 'Para pagar con tarjeta:';
  if (info.kind === 'account') return 'Para pagar a la cuenta:';
  return 'Para pagar por transferencia:';
};

/** Uppercase label above the payment line on the recibo PDF. */
export const paymentPdfHeading = (info: CompanyPaymentInfo): string => {
  if (info.kind === 'card') return 'PARA PAGAR CON TARJETA';
  if (info.kind === 'account') return 'PARA PAGAR A LA CUENTA';
  return 'PARA PAGAR POR TRANSFERENCIA';
};

/** Message lines for WhatsApp: a heading, the data line and the optional note. */
export const buildPaymentInfoLines = (info: CompanyPaymentInfo | null | undefined): string[] => {
  if (!info) return [];
  const line = formatPaymentInfoLine(info);
  if (!line) return [];
  return [paymentHeading(info), line, ...(info.note ? [info.note] : [])];
};
