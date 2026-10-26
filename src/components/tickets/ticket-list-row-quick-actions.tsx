'use client';

import { useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import type { Ticket } from '@/actions/tickets';
import { Button } from '@/components/ui/button';
import {
  TicketListCollectPaymentDialog,
  type TicketListCollectPaymentResult,
} from '@/components/tickets/ticket-list-collect-payment-dialog';
import { TicketRowActions } from '@/components/tickets/ticket-row-actions';
import { usePermissions } from '@/hooks/use-permissions';
import { companyDay } from '@/lib/company-day';
import { formatDocumentFolio } from '@/lib/folio';
import { hrefForTicketListRow } from '@/lib/ticket-list-navigation';
import { fetchAndDeliverTicketInvoice } from '@/lib/ticket-invoice-download';
import { getTicketBalanceDue } from '@/lib/ticket-payment-status';
import {
  canCollectTicketPayment,
  canDownloadTicketInvoice,
} from '@/lib/tickets-rbac';
import { Loader2 } from 'lucide-react';

type TicketListRowQuickActionsProps = {
  ticket: Ticket;
  onDelete: (id: number) => void;
  onDeleteFailed?: (id: number) => void;
  onPaymentApplied?: (result: TicketListCollectPaymentResult) => void;
  canWrite?: boolean;
  companyId?: number | null;
};

const buildListTicketPdfFileName = (ticket: Ticket): string => {
  const safeName =
    (ticket.client_name ?? 'ticket').replace(/[^\w\s\-]/g, '').trim() || 'ticket';
  const datePart = companyDay(
    ticket.ticket_date ? new Date(ticket.ticket_date) : new Date(),
  ).iso;
  return `${safeName}_${datePart}_${ticket.id.toString()}.pdf`;
};

/**
 * Hover and focus actions for a collections row (ZIG-I28-4). The ⋮ menu stays
 * visible; Cobrar, Terminar, Editar and PDF appear with the row.
 */
export const TicketListRowQuickActions = ({
  ticket,
  onDelete,
  onDeleteFailed,
  onPaymentApplied,
  canWrite = true,
  companyId,
}: TicketListRowQuickActionsProps) => {
  const { can } = usePermissions();
  const canDownload = canDownloadTicketInvoice(can);
  const canCollect = canCollectTicketPayment(can);
  const [collectOpen, setCollectOpen] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const balance = getTicketBalanceDue(ticket.total, ticket.paid);
  const hasServices = Boolean(ticket.services_summary?.trim());
  const showCollect = canWrite && canCollect && ticket.finished && balance > 0;
  const showTerminar = canWrite && !ticket.finished && hasServices;
  const showEditar = canWrite && !ticket.finished && !hasServices;
  const showPdf = canDownload && ticket.finished;
  const ticketId = ticket.id.toString();

  const handleDownloadPdf = async () => {
    if (isDownloading) return;
    try {
      setIsDownloading(true);
      const result = await fetchAndDeliverTicketInvoice({
        ticketId: ticket.id,
        companyId,
        downloadFileName: buildListTicketPdfFileName(ticket),
      });
      if (result === 'shared') {
        toast.success('PDF compartido correctamente');
      } else if (result === 'downloaded') {
        toast.success('PDF descargado correctamente');
      }
    } catch (error) {
      console.error('Error generating ticket PDF:', error);
      toast.error('No se pudo generar el PDF. Código: PDF001');
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="relative flex items-center justify-end">
      <div className="grid grid-cols-[0fr] group-hover:grid-cols-[1fr] group-focus-within:grid-cols-[1fr]">
        <div className="flex min-w-0 items-center gap-1 overflow-hidden opacity-0 group-hover:overflow-visible group-hover:opacity-100 group-focus-within:overflow-visible group-focus-within:opacity-100">
          {showCollect ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setCollectOpen(true)}
              aria-label={`Cobrar el ticket ${ticketId}`}
            >
              Cobrar
            </Button>
          ) : null}
          {showTerminar ? (
            <Button asChild variant="outline" size="sm">
              <Link
                href={hrefForTicketListRow(ticket, canWrite)}
                aria-label={`Terminar ticket ${ticketId}`}
              >
                Terminar
              </Link>
            </Button>
          ) : null}
          {showEditar ? (
            <Button asChild variant="outline" size="sm">
              <Link href={`/tickets/${ticketId}/edit`} aria-label={`Editar ticket ${ticketId}`}>
                Editar
              </Link>
            </Button>
          ) : null}
          {showPdf ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isDownloading}
              onClick={() => {
                void handleDownloadPdf();
              }}
              aria-label={`PDF del ticket ${ticketId}`}
            >
              {isDownloading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : 'PDF'}
            </Button>
          ) : null}
        </div>
      </div>
      <TicketRowActions
        ticket={ticket}
        onDelete={onDelete}
        onDeleteFailed={onDeleteFailed}
        onPaymentApplied={onPaymentApplied}
        canWrite={canWrite}
        companyId={companyId}
      />
      {showCollect ? (
        <TicketListCollectPaymentDialog
          open={collectOpen}
          onOpenChange={setCollectOpen}
          ticketId={Number(ticket.id)}
          total={ticket.total}
          paid={ticket.paid}
          companyId={companyId}
          folio={formatDocumentFolio(ticket)}
          clientName={ticket.client_name}
          clientTel={ticket.client_tel}
          onPaymentApplied={(result) => {
            onPaymentApplied?.(result);
          }}
        />
      ) : null}
    </div>
  );
};
