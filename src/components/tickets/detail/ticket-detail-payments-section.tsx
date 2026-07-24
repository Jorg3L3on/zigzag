'use client';

import { TicketPaymentCollectSection } from '@/components/tickets/ticket-payment-collect-section';
import {
  TicketDetailSectionCard,
  TicketDetailSectionHeading,
} from '@/components/tickets/detail/ticket-detail-section-card';
import { TicketPaymentBadge } from '@/components/tickets/ticket-payment-badge';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { FormattedCurrency } from '@/components/formatted-currency';
import {
  getTicketBalanceDue,
  getTicketPaymentStatus,
} from '@/lib/ticket-payment-status';

type TicketPaymentHistoryRow = {
  id: number;
  amount: number;
  created_at: Date | string;
};

type TicketDetailPaymentsSectionProps = {
  ticketId: number;
  total: number | null;
  paid: number | null;
  finished: boolean;
  payments: TicketPaymentHistoryRow[];
};

/**
 * Workspace wrapper around cobranza. Unfinished tickets show a compact
 * financial snapshot and point to edit for finish/initial payment.
 */
export const TicketDetailPaymentsSection = ({
  ticketId,
  total,
  paid,
  finished,
  payments,
}: TicketDetailPaymentsSectionProps) => {
  const balanceDue = getTicketBalanceDue(total, paid);
  const paymentStatus = getTicketPaymentStatus(total, paid);

  if (!finished) {
    return (
      <TicketDetailSectionCard
        id="cobranza"
        aria-labelledby="ticket-payments-heading"
      >
        <TicketDetailSectionHeading
          id="ticket-payments-heading"
          title="Pagos"
          description="La cobranza se habilita al finalizar el ticket"
          action={<TicketPaymentBadge total={total} paid={paid} />}
        />
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg bg-muted/40 px-3 py-2.5">
            <p className="text-xs text-muted-foreground">Total</p>
            <p className="font-semibold tabular-nums">
              <FormattedCurrency amount={total} />
            </p>
          </div>
          <div className="rounded-lg bg-muted/40 px-3 py-2.5">
            <p className="text-xs text-muted-foreground">Pagado</p>
            <p className="font-semibold tabular-nums">
              <FormattedCurrency amount={paid} />
            </p>
          </div>
          <div className="rounded-lg bg-muted/40 px-3 py-2.5">
            <p className="text-xs text-muted-foreground">Saldo</p>
            <p className="font-semibold tabular-nums">
              <FormattedCurrency amount={balanceDue} />
            </p>
          </div>
        </div>
        <p className="mt-4 text-sm text-muted-foreground">
          Estado actual:{' '}
          <span className="font-medium text-foreground">
            {paymentStatus === 'paid'
              ? 'Saldado'
              : paymentStatus === 'partial'
                ? 'Pago parcial'
                : 'Pendiente'}
          </span>
          . Finaliza el ticket para registrar cobros.
        </p>
        <div className="mt-4">
          <Button asChild variant="outline" size="sm">
            <Link href={`/tickets/${ticketId}/edit`}>Ir a editar</Link>
          </Button>
        </div>
      </TicketDetailSectionCard>
    );
  }

  return (
    <TicketDetailSectionCard aria-labelledby="ticket-payments-heading">
      <TicketDetailSectionHeading
        id="ticket-payments-heading"
        title="Pagos"
        description="Historial de abonos y saldo pendiente"
        action={<TicketPaymentBadge total={total} paid={paid} />}
      />
      <TicketPaymentCollectSection
        ticketId={ticketId}
        total={total}
        paid={paid}
        finished={finished}
        payments={payments}
      />
    </TicketDetailSectionCard>
  );
};
