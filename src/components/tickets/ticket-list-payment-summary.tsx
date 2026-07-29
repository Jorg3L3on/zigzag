'use client';

import { FormattedCurrency } from '@/components/formatted-currency';
import {
  getTicketPaymentProgressRatio,
  TicketPaymentProgressBar,
} from '@/components/tickets/ticket-payment-progress-bar';
import {
  getTicketPaymentStatus,
  TICKET_PAYMENT_STATUS_LABEL,
  type TicketPaymentStatus,
} from '@/lib/ticket-payment-status';
import { cn } from '@/lib/utils';

const STATUS_DOT_CLASS: Record<TicketPaymentStatus, string> = {
  paid: 'bg-emerald-500 dark:bg-emerald-400',
  partial: 'bg-orange-500 dark:bg-orange-400',
  pending: 'bg-slate-500 dark:bg-slate-400',
};

type TicketListPaymentSummaryProps = {
  total: number | null;
  paid: number | null;
  className?: string;
};

export const TicketListPaymentSummary = ({
  total,
  paid,
  className,
}: TicketListPaymentSummaryProps) => {
  const status = getTicketPaymentStatus(total, paid);
  const showBreakdown = status !== 'paid';
  const ratio = getTicketPaymentProgressRatio(total, paid);
  const percentLabel = Math.round(ratio * 100);

  return (
    <div className={cn('flex min-w-0 flex-col gap-1.5', className)}>
      <div className="flex min-w-0 items-center gap-2">
        <span
          className={cn('size-2 shrink-0 rounded-full', STATUS_DOT_CLASS[status])}
          aria-hidden
        />
        <span className="truncate text-sm font-medium leading-none text-foreground">
          {TICKET_PAYMENT_STATUS_LABEL[status]}
        </span>
      </div>
      {showBreakdown ? (
        <>
          <TicketPaymentProgressBar total={total} paid={paid} />
          <p className="text-xs leading-snug text-muted-foreground tabular-nums">
            <FormattedCurrency amount={paid ?? 0} />
            <span className="font-normal"> de </span>
            <FormattedCurrency amount={total} />
            <span aria-hidden> · </span>
            <span>{percentLabel}%</span>
          </p>
        </>
      ) : null}
    </div>
  );
};
