import { addMoney, lineTotalWithMaterials, roundMoney } from '@/lib/money';

/** Whole quantity ≥ 1. Service quantities accept decimals now: prefer `sanitizeQuantity`. */
export const sanitizeInteger = (value: string, fallback = 1) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(parsed, 1);
};

/**
 * A service quantity (ZIG-I12): decimals allowed, two places, never below 0.01
 * or above 9,999.99. The composer validates the raw text first and keeps the
 * user's own text visible; this is the value used for amounts and saves.
 */
export const sanitizeQuantity = (value: string, fallback = 1) => {
  const parsed = Number.parseFloat(value.replace(',', '.'));
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(roundMoney(parsed), 0.01), 9999.99);
};

/** Keeps digits and one decimal separator; never rewrites 1.5 into 15. */
export const cleanQuantityText = (value: string): string => {
  const normalized = value.replace(',', '.').replace(/[^\d.]/g, '');
  const [whole, ...rest] = normalized.split('.');
  return rest.length > 0 ? `${whole}.${rest.join('')}` : whole;
};

export const sanitizeDecimal = (value: string, fallback = 0) => {
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(parsed, 0);
};

export const formatServiceCurrency = (amount: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);

/** Σ lines, each with its materials on top (ZIG-I10). */
export const calculateServicesTotal = (
  services: Array<{
    quantity: number;
    price: number;
    materials?: ReadonlyArray<{ quantity: number | string; price: number | string }> | null;
  }>,
) => addMoney(...services.map(lineTotalWithMaterials));
