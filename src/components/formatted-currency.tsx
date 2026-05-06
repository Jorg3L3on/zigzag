'use client';

interface FormattedCurrencyProps {
  amount: number | null;
}

export function FormattedCurrency({ amount }: FormattedCurrencyProps) {
  if (amount === null) {
    return <span>Sin total</span>;
  }

  const formattedAmount = `$${amount.toLocaleString('es-MX', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

  return <span>{formattedAmount}</span>;
}
