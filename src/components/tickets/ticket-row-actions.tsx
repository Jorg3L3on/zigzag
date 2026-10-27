'use client';

import { companyDay } from '@/lib/company-day';
import { formatDocumentFolio } from '@/lib/folio';
import { useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { ListCardMenu, ListRowMenu, type ListCardMenuItem } from '@/components/list-page';
import { Eye, Pencil, FileDown, Banknote, Loader2, Trash2, CircleCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
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

type TicketRowActionsOptions = {
  ticket: Ticket;
  onDelete?: (id: number) => void;
  onDeleteFailed?: (id: number) => void;
  onPaymentApplied?: (result: TicketListCollectPaymentResult) => void;
  canWrite?: boolean;
  companyId?: number | null;
  /**
   * Adds Terminar for an open ticket. The desktop table passes it since its rows have
   * no hover buttons (ZIG-33); phone cards and Cobranza show Terminar elsewhere.
   */
  finishHref?: string;
};

const buildListTicketPdfFileName = (ticket: Ticket): string => {
  const safeName =
    (ticket.client_name ?? 'ticket').replace(/[^\w\s\-]/g, '').trim() ||
    'ticket';
  const datePart = companyDay(
    ticket.ticket_date ? new Date(ticket.ticket_date) : new Date(),
  ).iso;
  return `${safeName}_${datePart}_${ticket.id.toString()}.pdf`;
};

/**
 * One entry of a ticket row menu: the phone ⋮ (`ListCardMenu`) names the folio with
 * `ariaLabel` and draws `href` as a link; `ListRowMenu` uses `router.push`.
 */
export type TicketRowActionItem = ListCardMenuItem;

/**
 * The items of a ticket row menu and the dialogs they open (ZIG-I33-2): Ver detalles,
 * Terminar, Cobrar, Editar, Descargar ticket and Eliminar, by permission and state.
 * The desktop table draws them with `ListRowMenu` (`TicketRowMenu`); Cobranza's
 * phone cards keep the ⋮ of `TicketRowActions`. Render `dialogs` beside the menu.
 */
export const useTicketRowActions = (
  {
    ticket,
    onDelete,
    onDeleteFailed,
    onPaymentApplied,
    canWrite = true,
    companyId,
    finishHref,
  }: TicketRowActionsOptions,
  iconClassName = 'h-4 w-4',
): { label: string; items: TicketRowActionItem[]; dialogs: ReactNode } => {
  const router = useRouter();
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
  // Labels name the folio people see (R-0060); #id only for a row without one.
  const folio = formatDocumentFolio(ticket);

  // Keeps the menu open while the PDF is generated (preventDefault on the item event).
  const handleDownloadTicket = async (event?: Event) => {
    event?.preventDefault();
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

  const link = (href: string) => ({ href, onSelect: () => router.push(href) });
  const items: TicketRowActionItem[] = [
    {
      label: 'Ver detalles',
      icon: <Eye className={iconClassName} aria-hidden data-icon="inline-start" />,
      ...link(`/tickets/${ticket.id}`),
    },
  ];
  if (canWrite && !ticket.finished && finishHref) {
    items.push({
      label: 'Terminar',
      ariaLabel: `Terminar ${folio}`,
      icon: <CircleCheck className={iconClassName} aria-hidden data-icon="inline-start" />,
      ...link(finishHref),
    });
  }
  if (showCollectAction) {
    items.push({
      label: 'Cobrar',
      ariaLabel: `Cobrar ${folio}`,
      icon: <Banknote className={iconClassName} aria-hidden data-icon="inline-start" />,
      onSelect: () => setCollectOpen(true),
    });
  }
  if (canWrite && !ticket.finished) {
    items.push({
      label: 'Editar',
      icon: <Pencil className={iconClassName} aria-hidden data-icon="inline-start" />,
      ...link(`/tickets/${ticket.id}/edit`),
    });
  }
  if (canDownload) {
    items.push({
      label: isDownloading ? 'Generando…' : 'Descargar ticket',
      ariaLabel: `Descargar ${folio}`,
      disabled: isDownloading,
      icon: isDownloading ? (
        <Loader2 className={cn(iconClassName, 'animate-spin')} aria-hidden data-icon="inline-start" />
      ) : (
        <FileDown className={iconClassName} aria-hidden data-icon="inline-start" />
      ),
      onSelect: handleDownloadTicket,
    });
  }
  if (canWrite) {
    items.push({
      label: 'Eliminar',
      ariaLabel: `Eliminar ${folio}`,
      destructive: true,
      icon: <Trash2 className={iconClassName} aria-hidden data-icon="inline-start" />,
      onSelect: () => setDeleteOpen(true),
    });
  }

  const dialogs = (
    <>
      {canWrite ? (
        // Outside the menu: the menu closes when Eliminar is picked, the sheet stays.
        <DeleteTicketSheet
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          ticketId={Number(ticket.id)}
          folio={folio}
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
          folio={ticket.folio_number != null ? folio : null}
          clientName={ticket.client_name}
          clientTel={ticket.client_tel}
          onPaymentApplied={(result) => {
            onPaymentApplied?.(result);
          }}
        />
      ) : null}
    </>
  );

  return { label: `Más acciones de ${folio}`, items, dialogs };
};

/** The ⋯ of a desktop tickets row (ZIG-I33-2): `ListRowMenu` with the ticket items. */
export const TicketRowMenu = (props: TicketRowActionsOptions) => {
  const { label, items, dialogs } = useTicketRowActions(props);
  return (
    <>
      <ListRowMenu label={label} items={items} />
      {dialogs}
    </>
  );
};

/** The ⋮ menu of Cobranza's phone cards, from the same items (`ListCardMenu`). */
export function TicketRowActions(options: TicketRowActionsOptions) {
  const { label, items, dialogs } = useTicketRowActions(options, 'mr-2 h-4 w-4');

  return (
    <>
      <ListCardMenu label={label} items={items} />
      {dialogs}
    </>
  );
}
