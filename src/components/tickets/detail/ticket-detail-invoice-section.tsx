'use client';

import { FileText } from 'lucide-react';
import { PDFDownloadButton } from '@/components/pdf-download-button';
import {
  TicketDetailSectionCard,
  TicketDetailSectionHeading,
} from '@/components/tickets/detail/ticket-detail-section-card';
import { usePermissions } from '@/hooks/use-permissions';
import { canDownloadTicketInvoice } from '@/lib/tickets-rbac';
import {
  getTicketPaymentStatus,
  TICKET_PAYMENT_STATUS_LABEL,
} from '@/lib/ticket-payment-status';

type TicketDetailInvoiceSectionProps = {
  ticketId: number | bigint;
  finished: boolean;
  total: number | null;
  paid: number | null;
  downloadFileName: string;
};

export const TicketDetailInvoiceSection = ({
  ticketId,
  finished,
  total,
  paid,
  downloadFileName,
}: TicketDetailInvoiceSectionProps) => {
  const { can } = usePermissions();
  const canDownload = canDownloadTicketInvoice(can);
  const paymentStatus = getTicketPaymentStatus(total, paid);

  const statusLabel = !finished
    ? 'Disponible al finalizar'
    : `Lista · cobro ${TICKET_PAYMENT_STATUS_LABEL[paymentStatus].toLowerCase()}`;

  return (
    <TicketDetailSectionCard aria-labelledby="ticket-invoice-heading">
      <TicketDetailSectionHeading
        id="ticket-invoice-heading"
        title="Factura"
        description="PDF generado bajo demanda a partir de los datos del ticket"
      />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted/60 text-muted-foreground">
            <FileText className="h-4 w-4" aria-hidden />
          </span>
          <div className="min-w-0 space-y-0.5">
            <p className="text-sm font-medium text-foreground">{statusLabel}</p>
            <p className="text-xs text-muted-foreground">
              {finished
                ? 'Descarga o imprime la factura con el estado actual de pagos.'
                : 'Finaliza el ticket para habilitar la factura PDF.'}
            </p>
          </div>
        </div>

        {finished && canDownload ? (
          <PDFDownloadButton
            ticketId={ticketId}
            downloadFileName={downloadFileName}
            label="Descargar / imprimir"
            className="w-full sm:w-auto"
          />
        ) : null}
      </div>
    </TicketDetailSectionCard>
  );
};
