const trimTrailingZero = (value: string): string =>
  value.endsWith('.0') ? value.slice(0, -2) : value;

export const formatCompactNumber = (value: number): string => {
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';

  if (abs >= 1_000_000_000) {
    return `${sign}${trimTrailingZero((abs / 1_000_000_000).toFixed(1))}B`;
  }
  if (abs >= 1_000_000) {
    return `${sign}${trimTrailingZero((abs / 1_000_000).toFixed(1))}M`;
  }
  if (abs >= 1_000) {
    return `${sign}${trimTrailingZero((abs / 1_000).toFixed(1))}K`;
  }

  return `${value.toLocaleString('es-MX', {
    maximumFractionDigits: 0,
  })}`;
};

export const formatCompactCurrency = (value: number): string => {
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';

  if (abs >= 1_000_000_000) {
    return `${sign}$${trimTrailingZero((abs / 1_000_000_000).toFixed(1))}B`;
  }
  if (abs >= 1_000_000) {
    return `${sign}$${trimTrailingZero((abs / 1_000_000).toFixed(1))}M`;
  }
  if (abs >= 1_000) {
    return `${sign}$${trimTrailingZero((abs / 1_000).toFixed(1))}K`;
  }

  return `${sign}$${abs.toLocaleString('es-MX', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};
