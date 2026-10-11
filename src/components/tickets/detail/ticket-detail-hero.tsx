import { MoneyFigure } from '@/components/documents/money-figure';
import { TicketPaymentProgressBar } from '@/components/tickets/ticket-payment-progress-bar';
import { formatServiceCurrency } from '@/components/tickets/ticket-services-utils';
import { GLASS_CARD_CLASS } from '@/components/toolbar-glass';
import { getTicketBalanceDue, getTicketPaymentStatus } from '@/lib/ticket-payment-status';
import { cn } from '@/lib/utils';

type TicketDetailHeroProps = {
  finished: boolean;
  total: number | null;
  paid: number | null;
  className?: string;
};

/**
 * Balance first (ZIG-I13-4): Saldo por cobrar with the progress bar and
 * "Pagado X de Y". A settled ticket says Pagado with the total; one that is
 * still being worked on shows its Total.
 */
export const TicketDetailHero = ({ finished, total, paid, className }: TicketDetailHeroProps) => {
  const totalAmount = total ?? 0;
  const paidAmount = paid ?? 0;
  const balance = getTicketBalanceDue(total, paid);
  const status = getTicketPaymentStatus(total, paid);

  let label: string;
  let amount: number;
  if (!finished) {
    label = 'Total';
    amount = totalAmount;
  } else if (status === 'paid') {
    label = 'Pagado';
    amount = totalAmount;
  } else {
    label = 'Saldo por cobrar';
    amount = balance;
  }

  return (
    <section
      aria-label="Saldo"
      data-testid="ticket-hero"
      className={cn(GLASS_CARD_CLASS, 'space-y-2', className)}
    >
      <p className="text-[13px] text-muted-foreground">{label}</p>
      <MoneyFigure
        amount={amount}
        size="hero"
        className="block font-bold leading-tight"
        data-testid="ticket-hero-amount"
      />
      {finished ? (
        <>
          <TicketPaymentProgressBar total={total} paid={paid} className="max-w-none" />
          <p
            className="text-[13px] tabular-nums text-muted-foreground [overflow-wrap:anywhere]"
            data-testid="ticket-hero-paid"
          >
            {status === 'paid'
              ? 'Saldado'
              : `Pagado ${formatServiceCurrency(paidAmount)} de ${formatServiceCurrency(totalAmount)}`}
          </p>
        </>
      ) : (
        <p className="text-[13px] text-muted-foreground">
          El cobro se registra al finalizar el ticket.
        </p>
      )}
    </section>
  );
};
