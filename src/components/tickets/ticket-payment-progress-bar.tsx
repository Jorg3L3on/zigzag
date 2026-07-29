'use client';

import {
  getTicketPaymentProgressRatio,
  getTicketPaymentStatus,
  TICKET_PAYMENT_STATUS_ACCENT_CLASS,
} from '@/lib/ticket-payment-status';
import { cn } from '@/lib/utils';

type TicketPaymentProgressBarProps = {
  total: number | null;
  paid: number | null;
  className?: string;
};

export const TicketPaymentProgressBar = ({
  total,
  paid,
  className,
}: TicketPaymentProgressBarProps) => {
  const status = getTicketPaymentStatus(total, paid);
  const ratio = getTicketPaymentProgressRatio(total, paid);
  const percentLabel = Math.round(ratio * 100);
  const ariaLabel = `Progreso de pago ${percentLabel} por ciento`;

  return (
    <div
      className={cn(
        'h-2 w-full min-w-[7rem] max-w-[11rem] overflow-hidden rounded-full bg-muted',
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
          TICKET_PAYMENT_STATUS_ACCENT_CLASS[status],
        )}
        style={{ width: `${percentLabel}%` }}
        aria-hidden
      />
    </div>
  );
};
