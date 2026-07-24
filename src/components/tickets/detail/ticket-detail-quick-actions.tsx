'use client';

import Link from 'next/link';
import {
  FileText,
  Pencil,
  Receipt,
  Wallet,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PDFDownloadButton } from '@/components/pdf-download-button';
import { DASHBOARD_CARD_CLASS } from '@/components/dashboard/dashboard-surface';
import { usePermissions } from '@/hooks/use-permissions';
import {
  canAssignTicketServices,
  canCollectTicketPayment,
  canDownloadTicketInvoice,
  canEditTicket,
} from '@/lib/tickets-rbac';
import {
  getTicketPaymentStatus,
} from '@/lib/ticket-payment-status';
import { cn } from '@/lib/utils';

type TicketDetailQuickActionsProps = {
  ticketId: number | bigint;
  finished: boolean;
  total: number | null;
  paid: number | null;
  downloadFileName: string;
  className?: string;
};

export const TicketDetailQuickActions = ({
  ticketId,
  finished,
  total,
  paid,
  downloadFileName,
  className,
}: TicketDetailQuickActionsProps) => {
  const { can } = usePermissions();
  const id = Number(ticketId);
  const paymentStatus = getTicketPaymentStatus(total, paid);
  const canEdit = canEditTicket(can) && !finished;
  const canServices = canAssignTicketServices(can);
  const canCollect = canCollectTicketPayment(can);
  const canInvoice = canDownloadTicketInvoice(can) && finished;

  const showRegisterPayment =
    canCollect &&
    ((finished && paymentStatus === 'partial') || !finished);

  const paymentHref =
    finished && paymentStatus === 'partial'
      ? `#cobranza`
      : `/tickets/${id}/edit`;

  if (!canEdit && !canServices && !showRegisterPayment && !canInvoice) {
    return null;
  }

  return (
    <section
      aria-label="Acciones rápidas"
      className={cn(
        DASHBOARD_CARD_CLASS,
        'rounded-xl border p-4 sm:p-5',
        className,
      )}
    >
      <div className="mb-3 space-y-1">
        <h2 className="text-base font-semibold tracking-tight">
          Acciones rápidas
        </h2>
        <p className="text-sm text-muted-foreground">
          Accesos directos para continuar el trabajo en este ticket.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {canEdit ? (
          <Button asChild variant="default" className="h-10 gap-2">
            <Link
              href={`/tickets/${id}/edit`}
              aria-label="Editar ticket"
            >
              <Pencil className="h-4 w-4" aria-hidden />
              Editar
            </Link>
          </Button>
        ) : null}

        {canServices ? (
          <Button asChild variant="outline" className="h-10 gap-2">
            <Link
              href={`/tickets/${id}/services`}
              aria-label="Administrar servicios del ticket"
            >
              <Receipt className="h-4 w-4" aria-hidden />
              Servicios
            </Link>
          </Button>
        ) : null}

        {showRegisterPayment ? (
          <Button asChild variant="outline" className="h-10 gap-2">
            <Link
              href={paymentHref}
              aria-label={
                finished
                  ? 'Registrar pago en cobranza'
                  : 'Ir a editar para registrar pago al finalizar'
              }
            >
              <Wallet className="h-4 w-4" aria-hidden />
              Registrar pago
            </Link>
          </Button>
        ) : null}

        {canInvoice ? (
          <PDFDownloadButton
            ticketId={ticketId}
            downloadFileName={downloadFileName}
            label="Generar factura"
            className="h-10"
          />
        ) : null}
      </div>

      {!finished && canEdit ? (
        <p className="mt-3 flex items-start gap-2 text-xs text-muted-foreground">
          <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>
            Para finalizar el ticket y cobrar el anticipo, usa Editar.
          </span>
        </p>
      ) : null}
    </section>
  );
};
