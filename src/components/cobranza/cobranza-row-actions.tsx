'use client';

import * as React from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  Banknote,
  Eye,
  FileDown,
  Loader2,
  MessageCircle,
  MoreVertical,
  UserRound,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useCompanyPaymentInfo } from '@/hooks/use-company-payment-info';
import { usePermissions } from '@/hooks/use-permissions';
import { companyDay } from '@/lib/company-day';
import type { CobranzaRow } from '@/lib/cobranza';
import { fetchAndDeliverTicketInvoice } from '@/lib/ticket-invoice-download';
import {
  canCollectTicketPayment,
  canDownloadTicketInvoice,
} from '@/lib/tickets-rbac';
import { buildWhatsAppBalanceShare } from '@/lib/whatsapp-share';

/** Canvas CobA: a 30 px Cobrar outlined in the primary color, and a 30 px icon button. */
export const COLLECT_BUTTON_CLASS =
  'h-[30px] rounded-lg border-primary px-2.5 text-[13px] text-primary hover:bg-primary/10 hover:text-primary';
export const ICON_BUTTON_CLASS = 'h-[30px] w-[30px] rounded-lg';

type CobranzaRowActionsProps = {
  row: CobranzaRow;
  canWrite: boolean;
  companyId: number | null;
  companyName: string | null;
  onCollect: (row: CobranzaRow) => void;
};

const receiptFileName = (row: CobranzaRow): string => {
  const safeName =
    (row.client_name ?? 'ticket').replace(/[^\w\s\-]/g, '').trim() || 'ticket';
  const datePart = companyDay(new Date(row.ticket_date ?? row.created_at)).iso;
  return `${safeName}_${datePart}_${row.id}.pdf`;
};

/**
 * Cobrar and Recordar por WhatsApp show with the row (hover or focus); ⋮ stays
 * visible. No Editar or Eliminar here: the queue only collects (ZIG-I31-2).
 */
export const CobranzaRowActions = ({
  row,
  canWrite,
  companyId,
  companyName,
  onCollect,
}: CobranzaRowActionsProps) => {
  const { can } = usePermissions();
  const payment = useCompanyPaymentInfo();
  const [isDownloading, setIsDownloading] = React.useState(false);
  const showCollect = canWrite && canCollectTicketPayment(can);
  const canDownload = canDownloadTicketInvoice(can);
  const share = buildWhatsAppBalanceShare({
    phone: row.client_tel,
    clientName: row.client_name,
    ticketId: row.id,
    folio: row.folio,
    balanceDue: row.balanceDue,
    companyName,
    payment,
  });

  const handleDownload = async () => {
    if (isDownloading) return;
    try {
      setIsDownloading(true);
      const result = await fetchAndDeliverTicketInvoice({
        ticketId: BigInt(row.id),
        companyId,
        downloadFileName: receiptFileName(row),
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
      {/* Floats over the end of the row so the column only needs ⋮ (1024 with the sidebar open). */}
      <div className="pointer-events-none absolute right-full top-1/2 z-10 mr-1 flex -translate-y-1/2 items-center gap-1 rounded-lg bg-background p-1 opacity-0 shadow-sm ring-1 ring-border/60 group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100">
        {showCollect ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={COLLECT_BUTTON_CLASS}
            onClick={() => onCollect(row)}
            aria-label={`Cobrar el ticket ${row.folio}`}
          >
            Cobrar
          </Button>
        ) : null}
        {share ? (
          <Button asChild variant="outline" size="icon" className={ICON_BUTTON_CLASS}>
            <a
              href={share.href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Recordar por WhatsApp el ticket ${row.folio}`}
              title="Recordar por WhatsApp"
            >
              <MessageCircle className="h-3.5 w-3.5" aria-hidden />
            </a>
          </Button>
        ) : null}
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={`Más acciones del ticket ${row.folio}`}
          >
            <MoreVertical className="h-4 w-4" aria-hidden data-icon="inline-start" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {showCollect ? (
            <DropdownMenuItem onSelect={() => onCollect(row)}>
              <Banknote className="mr-2 h-4 w-4" aria-hidden data-icon="inline-start" />
              Cobrar
            </DropdownMenuItem>
          ) : null}
          {share ? (
            <DropdownMenuItem asChild>
              <a href={share.href} target="_blank" rel="noopener noreferrer">
                <MessageCircle className="mr-2 h-4 w-4" aria-hidden data-icon="inline-start" />
                Recordar por WhatsApp
              </a>
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem disabled>
              <MessageCircle className="mr-2 h-4 w-4" aria-hidden data-icon="inline-start" />
              Sin teléfono para WhatsApp
            </DropdownMenuItem>
          )}
          <DropdownMenuItem asChild>
            <Link href={`/tickets/${row.id}`}>
              <Eye className="mr-2 h-4 w-4" aria-hidden data-icon="inline-start" />
              Ver ticket
            </Link>
          </DropdownMenuItem>
          {canDownload ? (
            <DropdownMenuItem
              disabled={isDownloading}
              onSelect={(event) => {
                event.preventDefault();
                void handleDownload();
              }}
            >
              {isDownloading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden data-icon="inline-start" />
              ) : (
                <FileDown className="mr-2 h-4 w-4" aria-hidden data-icon="inline-start" />
              )}
              {isDownloading ? 'Generando…' : 'Descargar recibo'}
            </DropdownMenuItem>
          ) : null}
          {row.client_id != null ? (
            <DropdownMenuItem asChild>
              <Link href={`/clients/${row.client_id}`}>
                <UserRound className="mr-2 h-4 w-4" aria-hidden data-icon="inline-start" />
                Ver cliente
              </Link>
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};
