'use client';

import { FormattedCurrency } from '@/components/formatted-currency';
import { TicketPaymentProgressBar } from '@/components/tickets/ticket-payment-progress-bar';
import {
  getTicketBalanceDue,
  getTicketPaymentStatus,
  TICKET_PAYMENT_STATUS_LABEL,
} from '@/lib/ticket-payment-status';
import { cn } from '@/lib/utils';

type TicketDetailMoneyBarProps = {
  total: number | null;
  paid: number | null;
  className?: string;
  /** When set, Saldo / Pagado labels scroll to this anchor (e.g. #cobranza). */
  paymentsHref?: string;
};

export const TicketDetailMoneyBar = ({
  total,
  paid,
  className,
  paymentsHref = '#cobranza',
}: TicketDetailMoneyBarProps) => {
  const balanceDue = getTicketBalanceDue(total, paid);
  const status = getTicketPaymentStatus(total, paid);

  return (
    <div
      className={cn(
        'min-w-0 rounded-xl border border-border/50 bg-muted/30 px-3.5 py-3 sm:min-w-[280px] sm:px-4',
        className,
      )}
      aria-label={`Resumen de montos · ${TICKET_PAYMENT_STATUS_LABEL[status]}`}
    >
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">Total</p>
          <p className="truncate text-sm font-semibold tabular-nums tracking-tight sm:text-base">
            <FormattedCurrency amount={total} />
          </p>
        </div>
        <a
          href={paymentsHref}
          className="min-w-0 rounded-md outline-none transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Ver pagado en historial de pagos"
        >
          <p className="text-xs text-muted-foreground">Pagado</p>
          <p className="truncate text-sm font-semibold tabular-nums tracking-tight sm:text-base">
            <FormattedCurrency amount={paid} />
          </p>
        </a>
        <a
          href={paymentsHref}
          className="min-w-0 rounded-md outline-none transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Ver saldo en historial de pagos"
        >
          <p className="text-xs text-muted-foreground">Saldo</p>
          <p className="truncate text-sm font-semibold tabular-nums tracking-tight sm:text-base">
            <FormattedCurrency amount={balanceDue} />
          </p>
        </a>
      </div>
      <TicketPaymentProgressBar
        total={total}
        paid={paid}
        className="mt-3 max-w-none"
      />
    </div>
  );
};
