'use client';

import { Download, Loader2, MessageCircle, Wallet } from 'lucide-react';

import { useTicketCollect } from '@/components/tickets/detail/ticket-detail-collect-context';
import { useReceiptShare } from '@/components/tickets/use-receipt-share';
import { useCompany } from '@/contexts/company-context';
import { useCompanyPaymentInfo } from '@/hooks/use-company-payment-info';
import { usePermissions } from '@/hooks/use-permissions';
import { getTicketBalanceDue } from '@/lib/ticket-payment-status';
import { buildWhatsAppReceiptShare } from '@/lib/whatsapp-share';
import { canCollectTicketPayment, canDownloadTicketInvoice } from '@/lib/tickets-rbac';
import { cn } from '@/lib/utils';

type TicketDetailQuickActionsProps = {
  ticketId: number;
  /** Company folio shown in share titles and messages. */
  folio?: string | null;
  finished: boolean;
  total: number | null;
  paid: number | null;
  clientName: string | null;
  clientTel: string | null;
  /** File name for the PDF tile's download. */
  downloadFileName: string;
  className?: string;
};

const ACTION_CLASS =
  'flex h-[72px] min-w-0 flex-col items-center justify-center gap-1.5 rounded-xl border border-border bg-background px-1 text-caption text-foreground outline-none transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60';

/**
 * Cobrar / WhatsApp / PDF (ZIG-I13-4, ZIG-I18-16, ZIG-I24). Cobrar opens the
 * Registrar pago sheet; WhatsApp opens wa.me with the recibo text (hidden
 * without a phone); PDF downloads the recibo of a finished ticket. No Llamar
 * anywhere (Jorge, ZIG-27). Compartir recibo lives only in the sticky bar and
 * the header, so it shows once. Desktop has these in the header instead.
 */
export const TicketDetailQuickActions = ({
  ticketId,
  folio = null,
  finished,
  total,
  paid,
  clientName,
  clientTel,
  downloadFileName,
  className,
}: TicketDetailQuickActionsProps) => {
  const { can } = usePermissions();
  const collect = useTicketCollect();
  const { selectedCompany } = useCompany();
  const payment = useCompanyPaymentInfo();

  const phone = clientTel?.trim() || null;
  const showCobrar = finished && canCollectTicketPayment(can) && getTicketBalanceDue(total, paid) > 0;
  const whatsApp = finished && canDownloadTicketInvoice(can)
    ? buildWhatsAppReceiptShare({
        phone,
        clientName,
        ticketId,
        folio,
        total: total ?? 0,
        paid: paid ?? 0,
        companyName: selectedCompany?.name,
        payment,
      })
    : null;
  const showPdf = finished && canDownloadTicketInvoice(can);
  const { download, downloading } = useReceiptShare({
    ticketId: String(ticketId),
    folio,
    downloadFileName,
    clientName,
    clientTel,
    total: total ?? 0,
  });
  const count = Number(showCobrar) + Number(Boolean(whatsApp)) + Number(showPdf);
  if (count === 0) return null;

  return (
    <div
      className={cn(
        'grid gap-2',
        count === 1 ? 'grid-cols-1' : count === 2 ? 'grid-cols-2' : 'grid-cols-3',
        className,
      )}
      data-testid="ticket-quick-actions"
    >
      {showCobrar ? (
        <button type="button" className={ACTION_CLASS} onClick={() => collect?.openCollect()}>
          <Wallet className="h-5 w-5" aria-hidden />
          Cobrar
        </button>
      ) : null}
      {whatsApp ? (
        <a
          href={whatsApp.href}
          target="_blank"
          rel="noopener noreferrer"
          className={ACTION_CLASS}
        >
          <MessageCircle className="h-5 w-5" aria-hidden />
          WhatsApp
        </a>
      ) : null}
      {showPdf ? (
        <button
          type="button"
          className={ACTION_CLASS}
          aria-label="Descargar PDF"
          disabled={downloading}
          onClick={() => void download()}
        >
          {downloading ? (
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
          ) : (
            <Download className="h-5 w-5" aria-hidden />
          )}
          PDF
        </button>
      ) : null}
    </div>
  );
};
