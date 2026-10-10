import * as React from 'react';

import { formatServiceCurrency } from '@/components/tickets/ticket-services-utils';
import { cn } from '@/lib/utils';

export type MoneyFigureSize = 'sm' | 'md' | 'lg' | 'hero';

const SIZE_CLASS: Record<MoneyFigureSize, string[]> = {
  // [normal, 10+ digits, 12+ digits]
  sm: ['text-sm', 'text-sm', 'text-xs'],
  md: ['text-base', 'text-base', 'text-sm'],
  lg: ['text-xl', 'text-lg', 'text-base'],
  hero: ['text-4xl', 'text-3xl', 'text-2xl'],
};

/** Digits in the formatted amount, cents included. */
const countDigits = (formatted: string) => formatted.replace(/\D/g, '').length;

type MoneyFigureProps = Omit<React.HTMLAttributes<HTMLSpanElement>, 'children'> & {
  amount: number;
  size?: MoneyFigureSize;
  /** Draw it in the destructive colour (negative balances, errors). */
  tone?: 'default' | 'muted' | 'destructive';
};

/**
 * A peso amount that never truncates (ZIG-I13-1): it wraps anywhere if it has
 * to, and the big sizes step their font down at 10+ and 12+ digits so a
 * $1,342,504.79 total still fits a 333px card on one line.
 */
export const MoneyFigure = ({
  amount,
  size = 'md',
  tone = 'default',
  className,
  ...props
}: MoneyFigureProps) => {
  const formatted = formatServiceCurrency(amount);
  const digits = countDigits(formatted);
  const step = digits >= 12 ? 2 : digits >= 10 ? 1 : 0;
  return (
    <span
      data-money-size={size}
      className={cn(
        'min-w-0 font-semibold tabular-nums [overflow-wrap:anywhere]',
        SIZE_CLASS[size][step],
        tone === 'muted' && 'font-normal text-muted-foreground',
        tone === 'destructive' && 'text-destructive',
        className,
      )}
      {...props}
    >
      {formatted}
    </span>
  );
};
