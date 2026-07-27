'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MoreVertical, Eye, Pencil, FileDown, Banknote, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { DeleteTicketButton } from '@/components/delete-ticket-button';
import { usePermissions } from '@/hooks/use-permissions';
import { buildTicketInvoiceDownloadUrl } from '@/lib/ticket-invoice-url';
import {
  canDownloadTicketInvoice,
} from '@/lib/tickets-rbac';
import {
  getTicketPaymentStatus,
} from '@/lib/ticket-payment-status';

const PDF_DOWNLOAD_TIMEOUT_MS = 60_000;

interface Ticket {
  id: bigint;
  finished: boolean;
  total: number | null;
  paid: number | null;
  client_name?: string | null;
  ticket_date?: Date | null;
}

interface TicketRowActionsProps {
  ticket: Ticket;
  onDelete?: (id: number) => void;
  canWrite?: boolean;
  companyId?: number | null;
}

const buildListTicketPdfFileName = (ticket: Ticket): string => {
  const safeName =
    (ticket.client_name ?? 'ticket').replace(/[^\w\s\-]/g, '').trim() ||
    'ticket';
  const datePart = ticket.ticket_date
    ? ticket.ticket_date.toISOString().slice(0, 10)
    : new Date().toISOString().slice(0, 10);
  return `${safeName}_${datePart}_${ticket.id.toString()}.pdf`;
};

export function TicketRowActions({
  ticket,
  onDelete,
  canWrite = true,
  companyId,
}: TicketRowActionsProps) {
  const { can } = usePermissions();
  const canDownload = canDownloadTicketInvoice(can);
  const [isDownloading, setIsDownloading] = useState(false);

  const showCollectLink =
    canWrite &&
    ticket.finished &&
    getTicketPaymentStatus(ticket.total, ticket.paid) === 'partial';

  const handleDownloadTicket = async (event: Event) => {
    event.preventDefault();
    if (isDownloading) return;

    const abortController = new AbortController();
    const timeoutId = window.setTimeout(
      () => abortController.abort(),
      PDF_DOWNLOAD_TIMEOUT_MS,
    );

    try {
      setIsDownloading(true);
      const response = await fetch(
        buildTicketInvoiceDownloadUrl(ticket.id, companyId),
        {
          cache: 'no-store',
          signal: abortController.signal,
        },
      );

      if (!response.ok) {
        throw new Error(`PDF request failed with status ${response.status}`);
      }

      const pdf = await response.blob();
      const pdfUrl = URL.createObjectURL(pdf);
      const downloadLink = document.createElement('a');
      downloadLink.href = pdfUrl;
      downloadLink.download = buildListTicketPdfFileName(ticket);
      document.body.appendChild(downloadLink);
      downloadLink.click();
      downloadLink.remove();
      URL.revokeObjectURL(pdfUrl);
      toast.success('PDF descargado correctamente');
    } catch (error) {
      console.error('Error generating ticket PDF:', error);
      toast.error('No se pudo generar el PDF. Código: PDF001');
    } finally {
      window.clearTimeout(timeoutId);
      setIsDownloading(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Más acciones del ticket ${ticket.id.toString()}`}
        >
          <MoreVertical className="h-4 w-4" aria-hidden data-icon="inline-start"/>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <Link href={`/tickets/${ticket.id}`}>
          <DropdownMenuItem>
            <Eye className="mr-2 h-4 w-4" data-icon="inline-start" />
            Ver detalles
          </DropdownMenuItem>
        </Link>
        {showCollectLink && (
          <Link href={`/tickets/${ticket.id}#cobranza`}>
            <DropdownMenuItem>
              <Banknote className="mr-2 h-4 w-4" data-icon="inline-start" />
              Cobrar saldo
            </DropdownMenuItem>
          </Link>
        )}
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
          <DeleteTicketButton id={Number(ticket.id)} onDelete={onDelete} />
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
