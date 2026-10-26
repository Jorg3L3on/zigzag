'use client';

import { Download, Loader2, MessageCircle, Share2, Wallet } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { TripledMobileStickyActionBar } from '@/components/tripled';
import { useTicketCollect } from '@/components/tickets/detail/ticket-detail-collect-context';
import { TicketDetailActionsMenu } from '@/components/tickets/detail/ticket-detail-actions-menu';
import { useReceiptShare } from '@/components/tickets/use-receipt-share';
import { useCompany } from '@/contexts/company-context';
import { useCompanyPaymentInfo } from '@/hooks/use-company-payment-info';
import { usePermissions } from '@/hooks/use-permissions';
import { getTicketBalanceDue } from '@/lib/ticket-payment-status';
import { canCollectTicketPayment, canDownloadTicketInvoice } from '@/lib/tickets-rbac';
import { cn } from '@/lib/utils';
import { buildWhatsAppReceiptShare } from '@/lib/whatsapp-share';

type TicketDetailPrimaryActionsProps = {
  ticketId: number;
  /** Company folio shown in share titles and messages. */
  folio?: string | null;
  clientName: string | null;
  clientTel: string | null;
  finished: boolean;
  total: number | null;
  paid: number | null;
  paymentsCount: number;
  downloadFileName: string;
  /** desktop = header cluster; mobile-sticky = bottom bar. */
  placement: 'desktop' | 'mobile-sticky';
  className?: string;
};

/**
 * The one primary action of a finalized ticket (ZIG-I13-4): Cobrar while
 * there is a balance, Compartir recibo once settled. An unfinished ticket has
 * none here: the Finalizar panel owns it. The ⋯ menu sits in the app bar on
 * mobile and next to the button on desktop.
 */
export const TicketDetailPrimaryActions = ({
  ticketId,
  folio = null,
  clientName,
  clientTel,
  finished,
  total,
  paid,
  paymentsCount,
  downloadFileName,
  placement,
  className,
}: TicketDetailPrimaryActionsProps) => {
  const { can } = usePermissions();
  const collect = useTicketCollect();
  const { share, sharing, download, downloading } = useReceiptShare({
    ticketId: String(ticketId),
    folio,
    downloadFileName,
    clientName,
    clientTel,
    total: total ?? 0,
  });

  const canCollect = canCollectTicketPayment(can) && finished && getTicketBalanceDue(total, paid) > 0;
  const canPdf = canDownloadTicketInvoice(can);
  const canShare = canPdf && finished;
  const { selectedCompany } = useCompany();
  const payment = useCompanyPaymentInfo();
  // Desktop only (ZIG-I24): the recibo text on WhatsApp sits with the header
  // actions; phones keep it in the Cobrar / WhatsApp tiles.
  const whatsApp =
    placement === 'desktop' && canShare
      ? buildWhatsAppReceiptShare({
          phone: clientTel?.trim() || null,
          clientName,
          ticketId,
          folio,
          total: total ?? 0,
          paid: paid ?? 0,
          companyName: selectedCompany?.name,
          payment,
        })
      : null;

  const focusFinishCard = () => {
    const card = document.getElementById('terminar-ticket');
    card?.scrollIntoView({ block: 'center' });
    card?.focus();
  };

  const primary = !finished && placement === 'desktop' ? (
    <Button
      type="button"
      className="h-10 gap-2 rounded-xl text-base font-semibold"
      onClick={focusFinishCard}
    >
      Terminar ticket
    </Button>
  ) : canCollect ? (
    <Button
      type="button"
      className="h-12 w-full gap-2 rounded-xl text-base font-semibold md:h-10 md:w-auto"
      onClick={() => collect?.openCollect()}
    >
      <Wallet className="h-4 w-4" aria-hidden />
      Cobrar
    </Button>
  ) : canShare ? (
    <Button
      type="button"
      className="h-12 w-full gap-2 rounded-xl text-base font-semibold md:h-10 md:w-auto"
      disabled={sharing}
      onClick={() => void share(paid ?? 0)}
    >
      <Share2 className="h-4 w-4" aria-hidden />
      Compartir recibo
    </Button>
  ) : null;

  if (placement === 'desktop') {
    return (
      <div className={cn('flex flex-wrap items-center gap-2', className)}>
        {primary}
        {whatsApp ? (
          <Button
            asChild
            variant="outline"
            className="hidden h-10 gap-2 rounded-xl lg:inline-flex"
            data-testid="ticket-detail-whatsapp"
          >
            <a href={whatsApp.href} target="_blank" rel="noopener noreferrer">
              <MessageCircle className="h-4 w-4" aria-hidden />
              WhatsApp
            </a>
          </Button>
        ) : null}
        {canPdf && finished ? (
          <Button
            type="button"
            variant="outline"
            className="hidden h-10 gap-2 rounded-xl lg:inline-flex"
            aria-label="Descargar PDF"
            disabled={downloading}
            onClick={() => void download()}
            data-testid="ticket-detail-pdf"
          >
            {downloading ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Download className="h-4 w-4" aria-hidden />
            )}
            PDF
          </Button>
        ) : null}
        <TicketDetailActionsMenu
          ticketId={ticketId}
          folio={folio}
          clientName={clientName}
          clientTel={clientTel}
          total={total}
          paid={paid}
          paymentsCount={paymentsCount}
          downloadFileName={downloadFileName}
          inlineFromLg
          className="h-10 w-10 shrink-0 border border-input"
        />
      </div>
    );
  }

  return primary ? (
    <TripledMobileStickyActionBar innerClassName="max-w-6xl">
      <div className="w-full min-w-0">{primary}</div>
    </TripledMobileStickyActionBar>
  ) : null;
};
