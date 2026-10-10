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

/** Longest amount that still fits three columns at 375px (e.g. $12,345.67). */
const THREE_COLUMN_MAX_CHARS = 10;

const formatBarAmount = (amount: number | null) =>
  `$${(amount ?? 0).toLocaleString('es-MX', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

export const TicketDetailMoneyBar = ({
  total,
  paid,
  className,
  paymentsHref = '#cobranza',
}: TicketDetailMoneyBarProps) => {
  const balanceDue = getTicketBalanceDue(total, paid);
  const status = getTicketPaymentStatus(total, paid);
  // Money is never truncated: big amounts stack one per row on narrow screens.
  const stacked =
    Math.max(
      formatBarAmount(total).length,
      formatBarAmount(paid).length,
      formatBarAmount(balanceDue).length,
    ) > THREE_COLUMN_MAX_CHARS;
  const cellClass = stacked ? 'flex items-baseline justify-between gap-3 sm:block' : '';
  const valueClass =
    'text-sm font-semibold tabular-nums tracking-tight [overflow-wrap:anywhere] sm:text-base';

  return (
    <div
      className={cn(
        'min-w-0 rounded-xl border border-border/50 bg-muted/30 px-3.5 py-3 sm:min-w-[280px] sm:px-4',
        className,
      )}
      aria-label={`Resumen de montos · ${TICKET_PAYMENT_STATUS_LABEL[status]}`}
    >
      <div
        className={cn(
          'grid gap-2 sm:grid-cols-3 sm:gap-3',
          stacked ? 'grid-cols-1' : 'grid-cols-3',
        )}
        data-stacked={stacked ? 'true' : undefined}
      >
        <div className={cn('min-w-0', cellClass)}>
          <p className="text-xs text-muted-foreground">Total</p>
          <p className={cn(valueClass, stacked && 'text-right sm:text-left')}>
            <FormattedCurrency amount={total ?? 0} />
          </p>
        </div>
        <a
          href={paymentsHref}
          className={cn(
            'min-w-0 rounded-md outline-none transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring',
            cellClass,
          )}
          aria-label="Ver pagado en historial de pagos"
        >
          <p className="text-xs text-muted-foreground">Pagado</p>
          <p className={cn(valueClass, stacked && 'text-right sm:text-left')}>
            {(paid ?? 0) > 0 ? (
              <FormattedCurrency amount={paid} />
            ) : (
              <span className="font-medium text-muted-foreground">Sin pagos</span>
            )}
          </p>
        </a>
        <a
          href={paymentsHref}
          className={cn(
            'min-w-0 rounded-md outline-none transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring',
            cellClass,
          )}
          aria-label="Ver saldo en historial de pagos"
        >
          <p className="text-xs text-muted-foreground">Saldo</p>
          <p className={cn(valueClass, stacked && 'text-right sm:text-left')}>
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
