'use client';

import { Download, Loader2, Share2, Wallet } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { TripledMobileStickyActionBar } from '@/components/tripled';
import { useTicketCollect } from '@/components/tickets/detail/ticket-detail-collect-context';
import { TicketDetailActionsMenu } from '@/components/tickets/detail/ticket-detail-actions-menu';
import { useReceiptShare } from '@/components/tickets/use-receipt-share';
import { useCompany } from '@/contexts/company-context';
import { useCompanyPaymentInfo } from '@/hooks/use-company-payment-info';
import { usePermissions } from '@/hooks/use-permissions';
import { getTicketBalanceDue, isTicketFullyPaid } from '@/lib/ticket-payment-status';
import {
  canAssignTicketServices,
  canCollectTicketPayment,
  canDownloadTicketInvoice,
  canWriteTickets,
} from '@/lib/tickets-rbac';
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
 *
 * Header from lg (ZIG-I37-4; Compartir recibo and WhatsApp moved into ⋯ on
 * Jorge's ask, 2026-11-11), per state:
 * - En proceso: Terminar ticket · Editar · ⋯
 * - Terminado con saldo: PDF · Editar · ⋯ (WhatsApp in ⋯; no Cobrar: the «Saldo
 *   por cobrar» card holds the only desktop Cobrar; md–lg keeps it here)
 * - Pagado: PDF · ⋯ (Compartir recibo and WhatsApp in ⋯)
 * Every button is h-10, rounded-xl, text-sm; ⋯ is a 40px outline square.
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

  const hasBalance = finished && getTicketBalanceDue(total, paid) > 0;
  const canCollect = canCollectTicketPayment(can) && hasBalance;
  const canPdf = canDownloadTicketInvoice(can);
  const canShare = canPdf && finished;
  const { selectedCompany } = useCompany();
  const payment = useCompanyPaymentInfo();
  // Desktop only (ZIG-I24): the recibo text on WhatsApp is a ⋯ item from lg;
  // phones keep it in the Cobrar / WhatsApp tiles.
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

  const desktop = placement === 'desktop';
  // Same size as the outline buttons next to it in the header (ZIG-I37-4).
  const primaryClass = desktop
    ? 'h-10 gap-2 rounded-xl text-sm font-semibold'
    : 'h-12 w-full gap-2 rounded-xl text-base font-semibold md:h-10 md:w-auto';
  // From lg a ticket with a balance has no primary in the header: Cobrar lives in
  // the «Saldo por cobrar» card (only shown from lg), so md–lg still gets it here.
  const balanceOnlyBelowLg = desktop && hasBalance ? 'lg:hidden' : undefined;

  // Terminar points at the finish panel, which only renders for users who can write.
  const canFinish = canWriteTickets(can);
  const primary = !finished && desktop ? (canFinish ? (
    <Button type="button" className={primaryClass} onClick={focusFinishCard}>
      Terminar ticket
    </Button>
  ) : null) : canCollect ? (
    <Button
      type="button"
      className={cn(primaryClass, balanceOnlyBelowLg)}
      onClick={() => collect?.openCollect()}
    >
      <Wallet className="h-4 w-4" aria-hidden />
      Cobrar
    </Button>
  ) : canShare ? (
    <Button
      type="button"
      // From lg Compartir recibo is a ⋯ item (Jorge, 2026-11-11).
      className={cn(primaryClass, desktop && 'lg:hidden')}
      disabled={sharing}
      onClick={() => void share(paid ?? 0)}
    >
      <Share2 className="h-4 w-4" aria-hidden />
      Compartir recibo
    </Button>
  ) : null;

  if (placement === 'desktop') {
    // What TicketDetailActionsMenu shows from lg: Editar, and ⋯ only with Duplicar / Eliminar.
    const editOrMenuFromLg =
      (canAssignTicketServices(can) && !isTicketFullyPaid(total, paid)) || canWriteTickets(can);
    const anythingFromLg =
      (!finished && canFinish) ||
      (canShare && !hasBalance) ||
      Boolean(whatsApp) ||
      (canPdf && finished) ||
      editOrMenuFromLg;

    return (
      <div
        className={cn(
          // One row, never shrunk, when it sits beside the title (header from 48rem of page).
          'flex flex-wrap items-center gap-2 lg:@min-[48rem]:shrink-0 lg:@min-[48rem]:flex-nowrap',
          // Nothing left from lg (missing permissions): no empty column, the title takes the row.
          !anythingFromLg && 'lg:hidden',
          className,
        )}
        data-testid="ticket-detail-header-actions"
      >
        {primary}
        {canPdf && finished ? (
          <Button
            type="button"
            variant="outline"
            className="hidden h-10 gap-2 rounded-xl text-sm font-medium lg:inline-flex"
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
          shareFromLg={canShare && !hasBalance}
          whatsAppHrefFromLg={whatsApp?.href ?? null}
          className="h-10 w-10 shrink-0 rounded-xl"
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
