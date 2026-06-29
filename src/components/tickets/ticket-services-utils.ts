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

export const calculateServicesTotal = (
  services: Array<{ quantity: number; price: number }>,
) =>
  services.reduce(
    (total, service) => total + service.quantity * service.price,
    0,
  );
