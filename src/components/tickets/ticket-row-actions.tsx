'use client';

import { companyDay } from '@/lib/company-day';
import { formatDocumentFolio } from '@/lib/folio';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MoreHorizontal, MoreVertical, Eye, Pencil, FileDown, Banknote, Loader2, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { DeleteTicketSheet } from '@/components/tickets/delete-ticket-sheet';
import {
  TicketListCollectPaymentDialog,
  type TicketListCollectPaymentResult,
} from '@/components/tickets/ticket-list-collect-payment-dialog';
import { usePermissions } from '@/hooks/use-permissions';
import { fetchAndDeliverTicketInvoice } from '@/lib/ticket-invoice-download';
import {
  canCollectTicketPayment,
  canDownloadTicketInvoice,
} from '@/lib/tickets-rbac';
import {
  getTicketPaymentStatus,
} from '@/lib/ticket-payment-status';

interface Ticket {
  id: bigint;
  finished: boolean;
  total: number | null;
  paid: number | null;
  client_name?: string | null;
  client_tel?: string | null;
  ticket_date?: Date | null;
  folio_number?: number | null;
  folio_prefix?: string | null;
}

interface TicketRowActionsProps {
  ticket: Ticket;
  onDelete?: (id: number) => void;
  onDeleteFailed?: (id: number) => void;
  onPaymentApplied?: (result: TicketListCollectPaymentResult) => void;
  canWrite?: boolean;
  companyId?: number | null;
  /** The desktop table uses the canvas ⋯; phone cards and Cobranza keep ⋮. */
  triggerIcon?: 'vertical' | 'horizontal';
}

const buildListTicketPdfFileName = (ticket: Ticket): string => {
  const safeName =
    (ticket.client_name ?? 'ticket').replace(/[^\w\s\-]/g, '').trim() ||
    'ticket';
  const datePart = companyDay(
    ticket.ticket_date ? new Date(ticket.ticket_date) : new Date(),
  ).iso;
  return `${safeName}_${datePart}_${ticket.id.toString()}.pdf`;
};

export function TicketRowActions({
  ticket,
  onDelete,
  onDeleteFailed,
  onPaymentApplied,
  canWrite = true,
  companyId,
  triggerIcon = 'vertical',
}: TicketRowActionsProps) {
  const { can } = usePermissions();
  const canDownload = canDownloadTicketInvoice(can);
  const canCollect = canCollectTicketPayment(can);
  const [isDownloading, setIsDownloading] = useState(false);
  const [collectOpen, setCollectOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const paymentStatus = getTicketPaymentStatus(ticket.total, ticket.paid);
  const showCollectAction =
    canWrite &&
    canCollect &&
    ticket.finished &&
    paymentStatus !== 'paid';


  const handleDownloadTicket = async (event: Event) => {
    event.preventDefault();
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
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Más acciones del ticket ${ticket.id.toString()}`}
          >
            {triggerIcon === 'horizontal' ? (
              <MoreHorizontal className="h-4 w-4" aria-hidden data-icon="inline-start" />
            ) : (
              <MoreVertical className="h-4 w-4" aria-hidden data-icon="inline-start" />
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <Link href={`/tickets/${ticket.id}`}>
            <DropdownMenuItem>
              <Eye className="mr-2 h-4 w-4" data-icon="inline-start" />
              Ver detalles
            </DropdownMenuItem>
          </Link>
          {showCollectAction ? (
            <DropdownMenuItem
              onSelect={() => setCollectOpen(true)}
              aria-label={`Cobrar el ticket ${ticket.id.toString()}`}
            >
              <Banknote className="mr-2 h-4 w-4" data-icon="inline-start" />
              Cobrar
            </DropdownMenuItem>
          ) : null}
          {canWrite && !ticket.finished && (
            <Link href={`/tickets/${ticket.id}/edit`}>
              <DropdownMenuItem>
                <Pencil className="mr-2 h-4 w-4" data-icon="inline-start" />
                Editar
              </DropdownMenuItem>
            </Link>
          )}
          {canDownload ? (
            <DropdownMenuItem
              disabled={isDownloading}
              onSelect={handleDownloadTicket}
              aria-label={`Descargar ticket ${ticket.id.toString()}`}
            >
              {isDownloading ? (
                <Loader2
                  className="mr-2 h-4 w-4 animate-spin"
                  aria-hidden
                  data-icon="inline-start"
                />
              ) : (
                <FileDown className="mr-2 h-4 w-4" data-icon="inline-start" />
              )}
              {isDownloading ? 'Generando…' : 'Descargar ticket'}
            </DropdownMenuItem>
          ) : null}
          {canWrite ? (
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onSelect={() => setDeleteOpen(true)}
              aria-label={`Eliminar ticket ${ticket.id.toString()}`}
            >
              <Trash2 className="mr-2 h-4 w-4" data-icon="inline-start" />
              Eliminar
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      {canWrite ? (
        // Outside the menu: the menu closes when Eliminar is picked, the sheet stays.
        <DeleteTicketSheet
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          ticketId={Number(ticket.id)}
          folio={formatDocumentFolio(ticket)}
          clientName={ticket.client_name ?? null}
          total={ticket.total}
          paymentsTotal={ticket.paid ?? 0}
          companyId={companyId}
          afterDeleteHref={null}
          onDeleteStart={onDelete}
          onDeleteFailed={onDeleteFailed}
        />
      ) : null}

      {showCollectAction ? (
        <TicketListCollectPaymentDialog
          open={collectOpen}
          onOpenChange={setCollectOpen}
          ticketId={Number(ticket.id)}
          total={ticket.total}
          paid={ticket.paid}
          companyId={companyId}
          // The folio only when the ticket has one; the title never shows the internal id.
          folio={ticket.folio_number != null ? formatDocumentFolio(ticket) : null}
          clientName={ticket.client_name}
          clientTel={ticket.client_tel}
          onPaymentApplied={(result) => {
            onPaymentApplied?.(result);
          }}
        />
      ) : null}
    </>
  );
}
