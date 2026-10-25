'use client';

import { MoneyFigure } from '@/components/documents/money-figure';
import { FormattedDate } from '@/components/formatted-date';
import { Button } from '@/components/ui/button';
import { useTicketCollect } from '@/components/tickets/detail/ticket-detail-collect-context';
import {
  TicketDetailSectionCard,
  TicketDetailSectionHeading,
} from '@/components/tickets/detail/ticket-detail-section-card';
import { formatServiceCurrency } from '@/components/tickets/ticket-services-utils';
import { matchPaymentActor, type PaymentActorEvent } from '@/lib/ticket-payment-actor';
import {
  getTicketBalanceDue,
  getTicketPaymentProgressRatio,
  getTicketPaymentStatus,
} from '@/lib/ticket-payment-status';

type CollectPayment = {
  id: number;
  amount: number;
  created_at: Date | string;
};

type TicketDetailCollectCardProps = {
  total: number | null;
  paid: number | null;
  payments: CollectPayment[];
  events: ReadonlyArray<PaymentActorEvent>;
};

/** Cobro column for a finished ticket, from 1024px (ZIG-I28-2). */
export const TicketDetailCollectCard = ({
  total,
  paid,
  payments,
  events,
}: TicketDetailCollectCardProps) => {
  const collect = useTicketCollect();
  const status = getTicketPaymentStatus(total, paid);
  const paidFully = status === 'paid';
  const balance = getTicketBalanceDue(total, paid);
  const percent = Math.round(getTicketPaymentProgressRatio(total, paid) * 100);
  const totalAmount = total ?? 0;
  const label = paidFully ? 'Pagado' : 'Saldo por cobrar';
  const figure = paidFully ? totalAmount : balance;

  return (
    <TicketDetailSectionCard aria-labelledby="ticket-collect-heading" data-testid="ticket-collect-card">
      <TicketDetailSectionHeading id="ticket-collect-heading" title="Cobro" />
      <p className="text-caption text-muted-foreground">{label}</p>
      <MoneyFigure amount={figure} size="hero" className="mt-1 block text-[30px] font-bold leading-none" />
      <div
        className="mt-3 flex h-2 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-label={`Progreso de pago ${percent} por ciento`}
      >
        {payments.map((payment) => (
          <div
            key={payment.id}
            className="h-full bg-primary"
            style={{ width: totalAmount > 0 ? `${(payment.amount / totalAmount) * 100}%` : '0%' }}
          />
        ))}
      </div>
      <p className="mt-2 text-caption tabular-nums text-muted-foreground">
        Pagado {formatServiceCurrency(paid ?? 0)} de {formatServiceCurrency(totalAmount)} · {percent} %
      </p>
      {paidFully || !collect ? null : (
        <Button type="button" className="mt-3 w-full" onClick={collect.openCollect}>
          Cobrar
        </Button>
      )}
      <h3 className="mt-4 text-sm font-semibold">
        Pagos
        <span className="font-normal text-muted-foreground"> · {payments.length}</span>
      </h3>
      {payments.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">Sin pagos registrados.</p>
      ) : (
        <ul className="mt-1 divide-y divide-border/60" aria-label="Abonos del ticket">
          {payments.map((payment) => {
            const actor = matchPaymentActor(
              { amount: payment.amount, createdAt: payment.created_at },
              events,
            );
            const when =
              typeof payment.created_at === 'string' ? new Date(payment.created_at) : payment.created_at;
            return (
              <li key={payment.id} className="py-2.5 text-sm" data-testid="ticket-collect-payment">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-muted-foreground">
                    <FormattedDate withTime date={when} />
                  </span>
                  <MoneyFigure amount={payment.amount} size="sm" />
                </div>
                {actor ? (
                  <p className="text-caption text-muted-foreground">
                    {actor.actorName ?? 'Alguien'}
                    {actor.initial ? ' · al terminar el ticket' : null}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
      {paidFully ? null : (
        <div className="mt-2 flex items-baseline justify-between gap-3 border-t border-border pt-2 text-sm">
          <span className="font-medium">Saldo</span>
          <MoneyFigure amount={balance} size="sm" />
        </div>
      )}
    </TicketDetailSectionCard>
  );
};
