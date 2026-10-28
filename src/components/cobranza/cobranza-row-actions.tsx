'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Banknote, Eye, FileDown, MessageCircle, UserRound } from 'lucide-react';
import { ListRowMenu, type ListRowMenuItem } from '@/components/list-page';
import { Button } from '@/components/ui/button';
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

/**
 * The one always-visible button of a Cobranza row (ZIG-I33 §5): an outlined 32 px
 * Cobrar in the primary color, as in the canvas CobA.
 */
export const COLLECT_BUTTON_CLASS =
  'h-8 rounded-lg border-primary px-2.5 text-primary hover:bg-primary/10 hover:text-primary md:text-[13px]';

/** Opens a wa.me link from a menu item, which cannot be an anchor in ListRowMenu. */
export const openWhatsApp = (href: string) => {
  window.open(href, '_blank', 'noopener,noreferrer');
};

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
 * Cobrar always visible, then the ⋯ with Ver ticket, Recordar por WhatsApp and
 * Cobrar (ZIG-I33-3); Ver cliente and Descargar recibo stay in it as before.
 * Nothing shows on hover (85563215), and no Editar or Eliminar: the queue only
 * collects (ZIG-I31-2).
 */
export const CobranzaRowActions = ({
  row,
  canWrite,
  companyId,
  companyName,
  onCollect,
}: CobranzaRowActionsProps) => {
  const router = useRouter();
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
    setIsDownloading(true);
    try {
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

  const items: ListRowMenuItem[] = [
    {
      label: 'Ver ticket',
      icon: <Eye className="h-4 w-4" aria-hidden />,
      onSelect: () => router.push(`/tickets/${row.id}`),
    },
  ];
  if (share) {
    items.push({
      label: 'Recordar por WhatsApp',
      icon: <MessageCircle className="h-4 w-4" aria-hidden />,
      onSelect: () => openWhatsApp(share.href),
    });
  }
  if (showCollect) {
    items.push({
      label: 'Cobrar',
      icon: <Banknote className="h-4 w-4" aria-hidden />,
      onSelect: () => onCollect(row),
    });
  }
  if (row.client_id != null) {
    const clientId = row.client_id;
    items.push({
      label: 'Ver cliente',
      icon: <UserRound className="h-4 w-4" aria-hidden />,
      onSelect: () => router.push(`/clients/${clientId}`),
    });
  }
  if (canDownload) {
    items.push({
      label: 'Descargar recibo',
      icon: <FileDown className="h-4 w-4" aria-hidden />,
      onSelect: () => void handleDownload(),
    });
  }

  return (
    <div className="flex items-center justify-end gap-1">
      {showCollect ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={COLLECT_BUTTON_CLASS}
          onClick={() => onCollect(row)}
          aria-label={`Cobrar el ticket ${row.folio}`}
          data-testid="cobranza-collect"
        >
          Cobrar
        </Button>
      ) : null}
      <ListRowMenu label={`Más acciones del ticket ${row.folio}`} items={items} />
    </div>
  );
};
