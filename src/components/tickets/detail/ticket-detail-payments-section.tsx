import { FormattedCurrency } from '@/components/formatted-currency';
import { FormattedDate } from '@/components/formatted-date';
import {
  TicketDetailSectionCard,
  TicketDetailSectionHeading,
} from '@/components/tickets/detail/ticket-detail-section-card';

type TicketPaymentHistoryRow = {
  id: number;
  amount: number;
  created_at: Date | string;
};

type TicketDetailPaymentsSectionProps = {
  payments: TicketPaymentHistoryRow[];
};

/** Pagos · N: one compact row per abono (ZIG-I13-4). Only finalized tickets have payments. */
export const TicketDetailPaymentsSection = ({ payments }: TicketDetailPaymentsSectionProps) => (
  <TicketDetailSectionCard id="cobranza" aria-labelledby="ticket-payments-heading">
    <TicketDetailSectionHeading id="ticket-payments-heading" title="Pagos" count={payments.length} />
    {payments.length === 0 ? (
      <p className="text-sm text-muted-foreground">Sin pagos registrados.</p>
    ) : (
      <ul className="divide-y divide-border/60" aria-label="Abonos del ticket">
        {payments.map((row) => {
          const when = typeof row.created_at === 'string' ? new Date(row.created_at) : row.created_at;
          return (
            <li
              key={row.id}
              className="flex items-baseline justify-between gap-3 py-2.5 text-sm"
              data-testid="ticket-payment-row"
            >
              <span className="min-w-0 text-muted-foreground">
                <FormattedDate withTime date={when} />
              </span>
              <span className="shrink-0 font-medium tabular-nums">
                <FormattedCurrency amount={row.amount} />
              </span>
            </li>
          );
        })}
      </ul>
    )}
  </TicketDetailSectionCard>
);
