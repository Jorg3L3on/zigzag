'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowRightLeft,
  Ban,
  CalendarPlus,
  Copy,
  Download,
  Loader2,
  MessageCircle,
  Pencil,
  Ticket,
} from 'lucide-react';
import { toast } from 'sonner';

import type { PresupuestoTableItem } from '@/actions/presupuestos';
import { ListRowMenu, type ListRowMenuItem } from '@/components/list-page';
import { fetchAndDeliverTicketInvoice } from '@/lib/ticket-invoice-download';
import { buildWhatsAppQuoteReminder } from '@/lib/whatsapp-share';

export type PresupuestoRowHandlers = {
  onConvert: (item: PresupuestoTableItem) => void;
  onCancel: (item: PresupuestoTableItem) => void;
  onExtend: (item: PresupuestoTableItem) => void;
  onDuplicate: (item: PresupuestoTableItem) => void;
};

type PresupuestoRowMenuProps = PresupuestoRowHandlers & {
  item: PresupuestoTableItem;
  canWrite: boolean;
  canInvoice: boolean;
  companyId: number | null;
  companyName: string | null;
  /** A conversion, cancellation or duplicate is running: the row actions wait. */
  busy: boolean;
};

/**
 * The ⋯ of a presupuesto row (ZIG-I33-2), the only row actions: nothing appears on
 * hover (85563215). While open or expired: Convertir a ticket (once it has conceptos),
 * Editar, Recordar por WhatsApp; the PDF; Ver ticket R once accepted; Duplicar;
 * Extender vigencia; Cancelar presupuesto last.
 */
export const PresupuestoRowMenu = ({
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
}: PresupuestoRowMenuProps) => {
  const router = useRouter();
  const [downloading, setDownloading] = React.useState(false);
  const open = item.status === 'abierto' || item.status === 'vencido';
  const empty = !item.servicesSummary?.trim();
  // No folio means the R ticket is gone (deleted): nothing to open.
  const accepted =
    item.status === 'convertido' && Boolean(item.convertedToTicketId) && Boolean(item.convertedTicketFolio);
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

  // A running conversion or duplicate leaves the other actions waiting.
  const unlessBusy = (action: () => void) => () => {
    if (!busy) action();
  };

  const items: ListRowMenuItem[] = [];
  if (open && canWrite && !empty) {
    items.push({
      label: 'Convertir a ticket',
      icon: <ArrowRightLeft className="h-4 w-4" aria-hidden />,
      onSelect: unlessBusy(() => onConvert(item)),
    });
  }
  if (open && canWrite) {
    items.push({
      label: 'Editar',
      icon: <Pencil className="h-4 w-4" aria-hidden />,
      onSelect: () => router.push(`/presupuestos/${item.id}/edit`),
    });
  }
  if (reminder) {
    items.push({
      label: 'Recordar por WhatsApp',
      icon: <MessageCircle className="h-4 w-4" aria-hidden />,
      onSelect: () => {
        window.open(reminder.href, '_blank', 'noopener,noreferrer');
      },
    });
  }
  if (canInvoice) {
    items.push({
      label: downloading ? 'Generando…' : 'Descargar PDF',
      icon: downloading ? (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
      ) : (
        <Download className="h-4 w-4" aria-hidden />
      ),
      onSelect: () => void handleDownload(),
    });
  }
  if (accepted) {
    items.push({
      label: `Ver ticket ${item.convertedTicketFolio}`,
      icon: <Ticket className="h-4 w-4" aria-hidden />,
      onSelect: () => router.push(`/tickets/${item.convertedToTicketId}`),
    });
  }
  if (canWrite) {
    items.push({
      label: 'Duplicar',
      icon: <Copy className="h-4 w-4" aria-hidden />,
      onSelect: unlessBusy(() => onDuplicate(item)),
    });
  }
  if (open && canWrite) {
    items.push(
      {
        label: 'Extender vigencia',
        icon: <CalendarPlus className="h-4 w-4" aria-hidden />,
        onSelect: unlessBusy(() => onExtend(item)),
      },
      {
        label: 'Cancelar presupuesto',
        icon: <Ban className="h-4 w-4" aria-hidden />,
        onSelect: unlessBusy(() => onCancel(item)),
        destructive: true,
      },
    );
  }

  if (items.length === 0) return null;
  return <ListRowMenu label={`Más acciones de ${item.folio}`} items={items} />;
};
