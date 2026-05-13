'use client';

import { Badge } from '@/components/ui/badge';
import {
  getTicketPaymentStatus,
  TICKET_PAYMENT_STATUS_LABEL,
  type TicketPaymentStatus,
} from '@/lib/ticket-payment-status';
import { cn } from '@/lib/utils';

const STATUS_BADGE_CLASS: Record<TicketPaymentStatus, string> = {
  paid:
    'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100',
  partial:
    'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100',
  pending:
    'border-slate-200 bg-slate-50 text-slate-800 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-100',
};

type TicketPaymentBadgeProps = {
  total: number | null;
  paid: number | null;
  className?: string;
};

export const TicketPaymentBadge = ({
  total,
  paid,
  className,
}: TicketPaymentBadgeProps) => {
  const status = getTicketPaymentStatus(total, paid);

  return (
    <Badge
      variant="outline"
      className={cn(
        'font-medium shadow-none',
        STATUS_BADGE_CLASS[status],
        className,
      )}
    >
      {TICKET_PAYMENT_STATUS_LABEL[status]}
    </Badge>
  );
};
