'use client';

import {
  getTicketPaymentStatus,
  type TicketPaymentStatus,
} from '@/lib/ticket-payment-status';
import { cn } from '@/lib/utils';

const RING_SIZE = 28;
const STROKE_WIDTH = 3;
const RADIUS = (RING_SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

const RING_STROKE_CLASS: Record<Exclude<TicketPaymentStatus, 'paid'>, string> =
  {
    pending: 'stroke-slate-500 dark:stroke-slate-400',
    partial: 'stroke-amber-500 dark:stroke-amber-400',
  };

type TicketPaymentProgressRingProps = {
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

export const TicketPaymentProgressRing = ({
  total,
  paid,
  className,
}: TicketPaymentProgressRingProps) => {
  const status = getTicketPaymentStatus(total, paid);
  if (status === 'paid') {
    return null;
  }

  const ratio = getTicketPaymentProgressRatio(total, paid);
  const dashOffset = CIRCUMFERENCE * (1 - ratio);
  const percentLabel = Math.round(ratio * 100);
  const ariaLabel = `Progreso de pago ${percentLabel} por ciento`;

  return (
    <svg
      width={RING_SIZE}
      height={RING_SIZE}
      viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
      className={cn('shrink-0', className)}
      role="img"
      aria-label={ariaLabel}
    >
      <circle
        cx={RING_SIZE / 2}
        cy={RING_SIZE / 2}
        r={RADIUS}
        fill="none"
        strokeWidth={STROKE_WIDTH}
        className="stroke-muted"
        aria-hidden
      />
      <circle
        cx={RING_SIZE / 2}
        cy={RING_SIZE / 2}
        r={RADIUS}
        fill="none"
        strokeWidth={STROKE_WIDTH}
        strokeLinecap="round"
        strokeDasharray={CIRCUMFERENCE}
        strokeDashoffset={dashOffset}
        transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}
        className={cn(
          'transition-[stroke-dashoffset]',
          RING_STROKE_CLASS[status],
        )}
        aria-hidden
      />
    </svg>
  );
};
