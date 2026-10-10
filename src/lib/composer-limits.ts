/**
 * The composer's input limits, mirrored from the server schemas so a value that
 * would be rejected is explained under its field instead of failing at save
 * (ZIG-I12). Pure and client-safe. Each check returns the Spanish message to
 * show, or null when the text is fine.
 */
import { addMoney, MAX_TICKET_TOTAL } from '@/lib/money';

export const QUANTITY_MIN = 0.01;
export const QUANTITY_MAX = 9999.99;
export const PRICE_MAX = 99_999_999.99;

const formatLimit = (value: number): string =>
  value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const PRICE_MAX_MESSAGE = `Máximo $${formatLimit(PRICE_MAX)}`;
export const QUANTITY_MAX_MESSAGE = `Máximo ${formatLimit(QUANTITY_MAX)}`;
export const TOTAL_CAP_MESSAGE = `El total no puede pasar de $${formatLimit(MAX_TICKET_TOTAL)}`;

/** Text → number, accepting a comma as decimal separator; null when empty or not a number. */
export const parseDecimalText = (text: string): number | null => {
  const trimmed = text.trim().replace(',', '.');
  if (trimmed === '') return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
};

const decimalPlaces = (text: string): number => {
  const [, fraction = ''] = text.trim().replace(',', '.').split('.');
  return fraction.length;
};

/** A quantity of a service or a material: 0.01 to 9,999.99, two decimals. */
export const validateQuantityText = (text: string): string | null => {
  const value = parseDecimalText(text);
  if (value === null) return 'Escribe una cantidad';
  if (value < QUANTITY_MIN) return 'Mínimo 0.01';
  if (value > QUANTITY_MAX) return QUANTITY_MAX_MESSAGE;
  if (decimalPlaces(text) > 2) return 'Usa máximo 2 decimales';
  return null;
};

/** A unit price: 0 to 99,999,999.99, two decimals. Empty is not an error (the button stays off). */
export const validatePriceText = (text: string): string | null => {
  const value = parseDecimalText(text);
  if (value === null) return null;
  if (value < 0) return 'El precio no puede ser negativo';
  if (value > PRICE_MAX) return PRICE_MAX_MESSAGE;
  if (decimalPlaces(text) > 2) return 'Usa máximo 2 decimales';
  return null;
};

/**
 * Whether a line (service amount plus materials) still fits the document:
 * alone under the cap, and together with the other lines.
 */
export const validateLineAmount = (
  lineAmount: number,
  otherLinesTotal: number,
): string | null => {
  if (lineAmount > MAX_TICKET_TOTAL) return TOTAL_CAP_MESSAGE;
  if (addMoney(otherLinesTotal, lineAmount) > MAX_TICKET_TOTAL) return TOTAL_CAP_MESSAGE;
  return null;
};

/** Counters appear once 80% of a limit is used. */
export const COUNTER_THRESHOLD = 0.8;
export const shouldShowCounter = (length: number, max: number): boolean =>
  length >= Math.ceil(max * COUNTER_THRESHOLD);
