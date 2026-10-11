'use client';

import { Share2, Wallet } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { TripledMobileStickyActionBar } from '@/components/tripled';
import { useTicketCollect } from '@/components/tickets/detail/ticket-detail-collect-context';
import { TicketDetailActionsMenu } from '@/components/tickets/detail/ticket-detail-actions-menu';
import { useReceiptShare } from '@/components/tickets/use-receipt-share';
import { usePermissions } from '@/hooks/use-permissions';
import { getTicketBalanceDue } from '@/lib/ticket-payment-status';
import { canCollectTicketPayment, canDownloadTicketInvoice } from '@/lib/tickets-rbac';
import { cn } from '@/lib/utils';

type TicketDetailPrimaryActionsProps = {
  ticketId: number;
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
 * The one primary action of a finalized ticket (ZIG-I13-4): Registrar pago while
 * there is a balance, Compartir recibo once settled. An unfinished ticket has
 * none here: the Finalizar panel owns it. The ⋯ menu sits in the app bar on
 * mobile and next to the button on desktop.
 */
export const TicketDetailPrimaryActions = ({
  ticketId,
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
  const { share, sharing } = useReceiptShare({
    ticketId: String(ticketId),
    downloadFileName,
    clientName,
    clientTel,
    total: total ?? 0,
  });

  const canCollect = canCollectTicketPayment(can) && finished && getTicketBalanceDue(total, paid) > 0;
  const canShare = canDownloadTicketInvoice(can) && finished;

  const primary = canCollect ? (
    <Button
      type="button"
      className="h-12 w-full gap-2 rounded-xl text-base font-semibold md:h-10 md:w-auto"
      onClick={() => collect?.openCollect()}
    >
      <Wallet className="h-4 w-4" aria-hidden />
      Registrar pago
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
        <TicketDetailActionsMenu
          ticketId={ticketId}
          clientName={clientName}
          clientTel={clientTel}
          total={total}
          paid={paid}
          paymentsCount={paymentsCount}
          downloadFileName={downloadFileName}
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
