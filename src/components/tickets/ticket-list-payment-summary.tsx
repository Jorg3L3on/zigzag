'use client';

import { FormattedCurrency } from '@/components/formatted-currency';
import { TicketPaymentBadge } from '@/components/tickets/ticket-payment-badge';
import { TicketPaymentProgressRing } from '@/components/tickets/ticket-payment-progress-ring';
import {
  getTicketBalanceDue,
  getTicketPaymentStatus,
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
  const showBreakdown = status !== 'paid';
  const balanceDue = getTicketBalanceDue(total, paid);

  return (
    <div className={cn('flex min-w-0 flex-col gap-1.5', className)}>
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <TicketPaymentBadge total={total} paid={paid} />
        {showBreakdown ? (
          <TicketPaymentProgressRing total={total} paid={paid} />
        ) : null}
      </div>
      {showBreakdown ? (
        <dl className="grid gap-0.5 text-xs leading-snug text-muted-foreground">
          <div className="flex min-w-0 items-baseline justify-between gap-3">
            <dt>Pagado</dt>
            <dd className="tabular-nums font-medium text-foreground">
              <FormattedCurrency amount={paid ?? 0} />
            </dd>
          </div>
          <div className="flex min-w-0 items-baseline justify-between gap-3">
            <dt>Por pagar</dt>
            <dd className="tabular-nums font-medium text-foreground">
              <FormattedCurrency amount={balanceDue} />
            </dd>
          </div>
        </dl>
      ) : null}
    </div>
  );
};
