'use client';

import { useEffect, useState } from 'react';

interface FormattedCurrencyProps {
  amount: number | null;
}

export function FormattedCurrency({ amount }: FormattedCurrencyProps) {
  const [formattedAmount, setFormattedAmount] = useState<string>('Sin total');

  useEffect(() => {
    if (amount !== null) {
      setFormattedAmount(
        `$${amount.toLocaleString('es-MX', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`,
      );
    }
  }, [amount]);

  return <span>{formattedAmount}</span>;
}
