'use client';

import * as React from 'react';
import Link from 'next/link';
import { Ban, CalendarPlus, Copy, Download, Loader2, MessageCircle, MoreHorizontal, Pencil } from 'lucide-react';
import { toast } from 'sonner';

import type { PresupuestoTableItem } from '@/actions/presupuestos';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { fetchAndDeliverTicketInvoice } from '@/lib/ticket-invoice-download';
import { buildWhatsAppQuoteReminder } from '@/lib/whatsapp-share';

export type PresupuestoRowHandlers = {
  onConvert: (item: PresupuestoTableItem) => void;
  onCancel: (item: PresupuestoTableItem) => void;
  onExtend: (item: PresupuestoTableItem) => void;
  onDuplicate: (item: PresupuestoTableItem) => void;
};

type PresupuestoRowActionsProps = PresupuestoRowHandlers & {
  item: PresupuestoTableItem;
  canWrite: boolean;
  canInvoice: boolean;
  companyId: number | null;
  companyName: string | null;
  busy: boolean;
};

/**
 * Hover and focus actions of a presupuesto row (ZIG-I29-3, ListaPresuA):
 * Convertir, Recordar por WhatsApp and PDF while open or expired (Editar when
 * it has no conceptos yet), Ver ticket R once accepted, Duplicar once
 * canceled. The ⋮ menu is always visible.
 */
export const PresupuestoRowActions = ({
  item,
  canWrite,
  canInvoice,
  companyId,
  companyName,
  busy,
  onConvert,
  onCancel,
  onExtend,
  onDuplicate,
}: PresupuestoRowActionsProps) => {
  const [downloading, setDownloading] = React.useState(false);
  const open = item.status === 'abierto' || item.status === 'vencido';
  const empty = !item.servicesSummary?.trim();
  const editHref = `/presupuestos/${item.id}/edit`;
  // No folio means the R ticket is gone (deleted): nothing to open.
  const accepted =
    item.status === 'convertido' && Boolean(item.convertedToTicketId) && Boolean(item.convertedTicketFolio);
  const canceled = item.status === 'cancelado' && canWrite;
  const reminder = open
    ? buildWhatsAppQuoteReminder({
        phone: item.clientTel,
        clientName: item.clientName,
        ticketId: item.id,
        folio: item.folio,
        total: item.total ?? 0,
        servicesSummary: item.servicesSummary,
        validUntil: item.expiresAt,
        companyName,
      })
    : null;

  const hasQuickActions =
    (open && canWrite) || Boolean(reminder) || (open && canInvoice && !empty) || accepted || canceled;

  const handleDownload = async () => {
    if (downloading) return;
    setDownloading(true);
    try {
      const result = await fetchAndDeliverTicketInvoice({
        ticketId: item.id,
        companyId,
        downloadFileName: `presupuesto_${item.folio || item.id}.pdf`,
      });
      if (result === 'downloaded') toast.success('PDF descargado');
      if (result === 'shared') toast.success('PDF compartido');
    } catch {
      toast.error('No se pudo generar el PDF. Código: PDF001');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="relative flex items-center justify-end">
      {hasQuickActions ? (
        // Floats over Estado and Total so the table reserves room only for ⋮.
        <div
          className="pointer-events-none absolute right-full top-1/2 z-10 mr-1 flex -translate-y-1/2 items-center gap-1 rounded-lg bg-background p-1 opacity-0 shadow-sm ring-1 ring-border/60 group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100"
          data-testid="presupuesto-row-quick-actions"
        >
          {open && canWrite && !empty ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => onConvert(item)}
              aria-label={`Convertir ${item.folio} a ticket`}
            >
              Convertir
            </Button>
          ) : null}
          {open && canWrite && empty ? (
            <Button asChild variant="outline" size="sm">
              <Link href={editHref} aria-label={`Editar ${item.folio}`}>
                Editar
              </Link>
            </Button>
          ) : null}
          {reminder ? (
            <Button asChild variant="outline" size="sm" className="w-9 px-0">
              <a
                href={reminder.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Recordar ${item.folio} por WhatsApp`}
              >
                <MessageCircle className="h-4 w-4" aria-hidden />
              </a>
            </Button>
          ) : null}
          {open && canInvoice && !empty ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-9 px-0"
              disabled={downloading}
              onClick={() => void handleDownload()}
              aria-label={`PDF de ${item.folio}`}
            >
              {downloading ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <Download className="h-4 w-4" aria-hidden />
              )}
            </Button>
          ) : null}
          {accepted ? (
            <Button asChild variant="outline" size="sm">
              <Link href={`/tickets/${item.convertedToTicketId}`}>
                {`Ver ticket ${item.convertedTicketFolio}`}
              </Link>
            </Button>
          ) : null}
          {canceled ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => onDuplicate(item)}
              aria-label={`Duplicar ${item.folio}`}
            >
              Duplicar
            </Button>
          ) : null}
        </div>
      ) : null}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0"
            aria-label={`Más acciones de ${item.folio}`}
          >
            <MoreHorizontal className="h-4 w-4" aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          {open && canWrite ? (
            <DropdownMenuItem asChild className="min-h-11">
              <Link href={editHref}>
                <Pencil className="mr-2 h-4 w-4" aria-hidden />
                Editar
              </Link>
            </DropdownMenuItem>
          ) : null}
          {canWrite ? (
            <DropdownMenuItem className="min-h-11" disabled={busy} onSelect={() => onDuplicate(item)}>
              <Copy className="mr-2 h-4 w-4" aria-hidden />
              Duplicar
            </DropdownMenuItem>
          ) : null}
          {open && canWrite ? (
            <DropdownMenuItem className="min-h-11" disabled={busy} onSelect={() => onExtend(item)}>
              <CalendarPlus className="mr-2 h-4 w-4" aria-hidden />
              Extender vigencia
            </DropdownMenuItem>
          ) : null}
          {canInvoice ? (
            <DropdownMenuItem
              className="min-h-11"
              disabled={downloading}
              onSelect={() => void handleDownload()}
            >
              <Download className="mr-2 h-4 w-4" aria-hidden />
              Descargar PDF
            </DropdownMenuItem>
          ) : null}
          {open && canWrite ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="min-h-11 text-destructive focus:text-destructive"
                disabled={busy}
                onSelect={() => onCancel(item)}
              >
                <Ban className="mr-2 h-4 w-4" aria-hidden />
                Cancelar presupuesto
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};
