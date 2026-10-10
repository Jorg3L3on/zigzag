import { addMoney, lineTotalWithMaterials } from '@/lib/money';

export const sanitizeInteger = (value: string, fallback = 1) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(parsed, 1);
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
