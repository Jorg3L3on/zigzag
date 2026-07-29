'use client';

import {
  getTicketPaymentStatus,
  type TicketPaymentStatus,
} from '@/lib/ticket-payment-status';
import { cn } from '@/lib/utils';

const BAR_FILL_CLASS: Record<Exclude<TicketPaymentStatus, 'paid'>, string> = {
  pending: 'bg-slate-500 dark:bg-slate-400',
  partial: 'bg-orange-500 dark:bg-orange-400',
};

type TicketPaymentProgressBarProps = {
  total: number | null;
  paid: number | null;
  className?: string;
};

export const getTicketPaymentProgressRatio = (
  total: number | null | undefined,
  paid: number | null | undefined,
): number => {
  const totalAmount = total ?? 0;
  if (totalAmount <= 0) return 0;
  const paidAmount = Math.max(0, paid ?? 0);
  return Math.min(1, Math.max(0, paidAmount / totalAmount));
};

export const TicketPaymentProgressBar = ({
  total,
  paid,
  className,
}: TicketPaymentProgressBarProps) => {
  const status = getTicketPaymentStatus(total, paid);
  if (status === 'paid') {
    return null;
  }

  const ratio = getTicketPaymentProgressRatio(total, paid);
  const percentLabel = Math.round(ratio * 100);
  const ariaLabel = `Progreso de pago ${percentLabel} por ciento`;

  return (
    <div
      className={cn(
        'h-1.5 w-full min-w-[6.5rem] overflow-hidden rounded-full bg-muted',
        className,
      )}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percentLabel}
      aria-label={ariaLabel}
    >
      <div
        className={cn(
          'h-full rounded-full transition-[width]',
          BAR_FILL_CLASS[status],
        )}
        style={{ width: `${percentLabel}%` }}
        aria-hidden
      />
    </div>
  );
};
