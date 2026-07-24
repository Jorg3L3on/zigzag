import { FormattedCurrency } from '@/components/formatted-currency';
import { FormattedDate } from '@/components/formatted-date';
import {
  TicketDetailSectionCard,
  TicketDetailSectionHeading,
} from '@/components/tickets/detail/ticket-detail-section-card';
import { TicketPaymentBadge } from '@/components/tickets/ticket-payment-badge';
import { getTicketBalanceDue } from '@/lib/ticket-payment-status';

type TicketDetailMetaSummaryProps = {
  finished: boolean;
  total: number | null;
  paid: number | null;
  ticketDate: Date | null;
  createdAt: Date;
  updatedAt: Date | null;
  creatorName: string | null;
  serviceCount: number;
  paymentCount: number;
};

export const TicketDetailMetaSummary = ({
  finished,
  total,
  paid,
  ticketDate,
  createdAt,
  updatedAt,
  creatorName,
  serviceCount,
  paymentCount,
}: TicketDetailMetaSummaryProps) => {
  const balanceDue = getTicketBalanceDue(total, paid);

  return (
    <TicketDetailSectionCard aria-labelledby="ticket-meta-heading">
      <TicketDetailSectionHeading
        id="ticket-meta-heading"
        title="Resumen"
        description="Estado y montos del ticket"
        action={<TicketPaymentBadge total={total} paid={paid} />}
      />

      <dl className="space-y-3 text-sm">
        <div className="flex items-center justify-between gap-3">
          <dt className="text-muted-foreground">Estado</dt>
          <dd className="font-medium text-foreground">
            {finished ? 'Finalizado' : 'En proceso'}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="text-muted-foreground">Total</dt>
          <dd className="font-medium tabular-nums text-foreground">
            <FormattedCurrency amount={total} />
          </dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="text-muted-foreground">Pagado</dt>
          <dd className="font-medium tabular-nums text-foreground">
            <FormattedCurrency amount={paid} />
          </dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="text-muted-foreground">Saldo</dt>
          <dd className="font-medium tabular-nums text-foreground">
            <FormattedCurrency amount={balanceDue} />
          </dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="text-muted-foreground">Servicios</dt>
          <dd className="font-medium tabular-nums text-foreground">
            {serviceCount}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="text-muted-foreground">Abonos</dt>
          <dd className="font-medium tabular-nums text-foreground">
            {paymentCount}
          </dd>
        </div>
        {creatorName ? (
          <div className="flex items-start justify-between gap-3">
            <dt className="text-muted-foreground">Creado por</dt>
            <dd className="max-w-[60%] text-right font-medium text-foreground">
              {creatorName}
            </dd>
          </div>
        ) : null}
        <div className="flex items-start justify-between gap-3 border-t border-border/50 pt-3">
          <dt className="text-muted-foreground">Fecha ticket</dt>
          <dd className="text-right font-medium text-foreground">
            <FormattedDate date={ticketDate} />
          </dd>
        </div>
        <div className="flex items-start justify-between gap-3">
          <dt className="text-muted-foreground">Creado</dt>
          <dd className="text-right font-medium text-foreground">
            <FormattedDate date={createdAt} withTime />
          </dd>
        </div>
        <div className="flex items-start justify-between gap-3">
          <dt className="text-muted-foreground">Actualizado</dt>
          <dd className="text-right font-medium text-foreground">
            <FormattedDate date={updatedAt ?? createdAt} withTime />
          </dd>
        </div>
      </dl>
    </TicketDetailSectionCard>
  );
};
