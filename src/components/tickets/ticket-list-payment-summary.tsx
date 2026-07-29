'use client';

import { TicketPaymentProgressBar } from '@/components/tickets/ticket-payment-progress-bar';
import {
  formatTicketListAmount,
  getTicketPaymentStatus,
  TICKET_PAYMENT_STATUS_ACCENT_CLASS,
  TICKET_PAYMENT_STATUS_LABEL,
} from '@/lib/ticket-payment-status';
import { cn } from '@/lib/utils';

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

  return (
    <div
      className={cn('flex min-w-[8.5rem] max-w-[12rem] flex-col gap-1.5', className)}
      data-testid="ticket-payment-summary"
      data-payment-status={status}
    >
      <div className="flex min-w-0 items-center gap-2">
        <span
          className={cn(
            'size-2 shrink-0 rounded-full',
            TICKET_PAYMENT_STATUS_ACCENT_CLASS[status],
          )}
          aria-hidden
        />
        <span className="truncate text-sm font-medium leading-none text-foreground">
          {TICKET_PAYMENT_STATUS_LABEL[status]}
        </span>
      </div>
      <TicketPaymentProgressBar total={total} paid={paid} />
      <p className="truncate text-xs leading-snug text-muted-foreground tabular-nums">
        <span>{formatTicketListAmount(paid ?? 0)}</span>
        <span className="font-normal text-muted-foreground/80"> de </span>
        <span>{formatTicketListAmount(total)}</span>
      </p>
    </div>
  );
};
