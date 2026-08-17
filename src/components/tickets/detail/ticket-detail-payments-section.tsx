'use client';

import Link from 'next/link';
import { TicketPaymentCollectSection } from '@/components/tickets/ticket-payment-collect-section';
import {
  TicketDetailSectionCard,
  TicketDetailSectionHeading,
} from '@/components/tickets/detail/ticket-detail-section-card';
import { Button } from '@/components/ui/button';

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
  companyId?: number | null;
};

/**
 * Pagos owns money detail. Unfinished tickets point at the finish panel;
 * finished tickets show collect + history.
 */
export const TicketDetailPaymentsSection = ({
  ticketId,
  total,
  paid,
  finished,
  payments,
  companyId = null,
}: TicketDetailPaymentsSectionProps) => {
  if (!finished) {
    return (
      <TicketDetailSectionCard
        id="cobranza"
        aria-labelledby="ticket-payments-heading"
      >
        <TicketDetailSectionHeading
          id="ticket-payments-heading"
          title="Pagos"
          count={payments.length}
          description="La cobranza se habilita al finalizar el ticket"
        />
        <p className="text-sm text-muted-foreground">
          Finaliza el ticket para registrar el anticipo o el pago completo.
        </p>
        <div className="mt-4">
          <Button asChild variant="outline" size="sm">
            <Link href="#finalizar" aria-label="Ir a finalizar ticket">
              Ir a finalizar
            </Link>
          </Button>
        </div>
      </TicketDetailSectionCard>
    );
  }

  return (
    <TicketDetailSectionCard
      id="cobranza"
      aria-labelledby="ticket-payments-heading"
    >
      <TicketDetailSectionHeading
        id="ticket-payments-heading"
        title="Pagos"
        count={payments.length}
        description="Historial de abonos y saldo pendiente"
      />
      <TicketPaymentCollectSection
        ticketId={ticketId}
        total={total}
        paid={paid}
        finished={finished}
        payments={payments}
        companyId={companyId}
      />
    </TicketDetailSectionCard>
  );
};
