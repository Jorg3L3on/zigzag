'use client';

import { format } from 'date-fns';
import { es } from 'date-fns/locale';

import { MoneyFigure } from '@/components/documents/money-figure';
import { Button } from '@/components/ui/button';
import { useTicketCollect } from '@/components/tickets/detail/ticket-detail-collect-context';
import {
  TICKET_RAIL_LABEL_CLASS,
  TicketDetailRailLabel,
  TicketDetailSectionCard,
} from '@/components/tickets/detail/ticket-detail-section-card';
import { formatServiceCurrency } from '@/components/tickets/ticket-services-utils';
import { cn } from '@/lib/utils';
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

  // Newest first, as the canvas lists them.
  const listed = [...payments].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
  const shades = ['bg-emerald-600', 'bg-emerald-400'];

  return (
    <TicketDetailSectionCard aria-labelledby="ticket-collect-heading" data-testid="ticket-collect-card">
      <TicketDetailRailLabel id="ticket-collect-heading">{label}</TicketDetailRailLabel>
      <MoneyFigure
        amount={figure}
        size="hero"
        className="mt-1.5 block text-[30px] font-bold leading-[1.1] tracking-tight"
      />
      <div
        className="mt-3.5 flex h-2 gap-0.5 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-label={`Pagado ${percent} por ciento en ${payments.length} ${payments.length === 1 ? 'pago' : 'pagos'}`}
      >
        {[...listed].reverse().map((payment, index) => (
          <div
            key={payment.id}
            className={cn('h-full', shades[index % shades.length])}
            style={{ width: totalAmount > 0 ? `${(payment.amount / totalAmount) * 100}%` : '0%' }}
          />
        ))}
      </div>
      <div className="mt-2 flex flex-wrap justify-between gap-x-3 text-caption tabular-nums text-muted-foreground">
        <span className="whitespace-nowrap">
          Pagado {formatServiceCurrency(paid ?? 0)} · {percent} %
        </span>
        <span className="whitespace-nowrap">de {formatServiceCurrency(totalAmount)}</span>
      </div>
      {paidFully || !collect ? null : (
        <Button type="button" className="mt-4 h-11 w-full text-[15px]" onClick={collect.openCollect}>
          Cobrar
        </Button>
      )}
      <h3 className={cn(TICKET_RAIL_LABEL_CLASS, 'mt-5')}>
        Pagos · {payments.length}
      </h3>
      {listed.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">Sin pagos registrados.</p>
      ) : (
        <ul aria-label="Abonos del ticket">
          {listed.map((payment) => {
            const actor = matchPaymentActor(
              { amount: payment.amount, createdAt: payment.created_at },
              events,
            );
            const when =
              typeof payment.created_at === 'string' ? new Date(payment.created_at) : payment.created_at;
            return (
              <li
                key={payment.id}
                className="flex items-start justify-between gap-3 border-b border-border/50 py-2.5 text-sm"
                data-testid="ticket-collect-payment"
              >
                {/* The amount never breaks (the date wraps instead): PR #610 review. */}
                <span className="min-w-0">
                  <span className="block font-medium tabular-nums">
                    {format(when, "d 'de' MMMM 'de' yyyy · HH:mm", { locale: es })}
                  </span>
                  {actor ? (
                    <span className="block text-caption text-muted-foreground">
                      {actor.actorName ?? 'Alguien'}
                      {actor.initial ? ' · al terminar el ticket' : null}
                    </span>
                  ) : null}
                </span>
                <MoneyFigure
                  amount={payment.amount}
                  size="sm"
                  className="shrink-0 whitespace-nowrap [overflow-wrap:normal]"
                />
              </li>
            );
          })}
        </ul>
      )}
      {paidFully ? null : (
        <div className="flex items-baseline justify-between gap-3 pt-2.5 text-sm text-muted-foreground">
          <span>Saldo</span>
          <MoneyFigure
            amount={balance}
            size="sm"
            className="shrink-0 whitespace-nowrap text-foreground [overflow-wrap:normal]"
          />
        </div>
      )}
    </TicketDetailSectionCard>
  );
};
