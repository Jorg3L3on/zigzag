'use client';

import { Phone, Share2, Wallet, Loader2 } from 'lucide-react';

import { useTicketCollect } from '@/components/tickets/detail/ticket-detail-collect-context';
import { useReceiptShare } from '@/components/tickets/use-receipt-share';
import { usePermissions } from '@/hooks/use-permissions';
import { getTicketBalanceDue } from '@/lib/ticket-payment-status';
import { canCollectTicketPayment, canDownloadTicketInvoice } from '@/lib/tickets-rbac';
import { cn } from '@/lib/utils';

type TicketDetailQuickActionsProps = {
  ticketId: number;
  finished: boolean;
  total: number | null;
  paid: number | null;
  clientName: string | null;
  clientTel: string | null;
  downloadFileName: string;
  className?: string;
};

const ACTION_CLASS =
  'flex h-[72px] min-w-0 flex-col items-center justify-center gap-1.5 rounded-xl border border-border bg-background px-1 text-[13px] text-foreground outline-none transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60';

/**
 * Cobrar / Compartir recibo / Llamar (ZIG-I13-4). Cobrar opens the Registrar
 * pago sheet; Compartir recibo needs a finalized ticket; Llamar is a tel: link
 * and is hidden without a phone.
 */
export const TicketDetailQuickActions = ({
  ticketId,
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
  const { share, sharing } = useReceiptShare({
    ticketId: String(ticketId),
    downloadFileName,
    clientName,
    clientTel,
    total: total ?? 0,
  });

  const phone = clientTel?.trim() || null;
  const showCobrar = finished && canCollectTicketPayment(can) && getTicketBalanceDue(total, paid) > 0;
  const showShare = finished && canDownloadTicketInvoice(can);
  const count = Number(showCobrar) + Number(showShare) + Number(Boolean(phone));
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
      {showShare ? (
        <button
          type="button"
          className={ACTION_CLASS}
          disabled={sharing}
          onClick={() => void share(paid ?? 0)}
        >
          {sharing ? (
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
          ) : (
            <Share2 className="h-5 w-5" aria-hidden />
          )}
          Compartir recibo
        </button>
      ) : null}
      {phone ? (
        <a href={`tel:${phone.replace(/[^\d+]/g, '')}`} className={ACTION_CLASS}>
          <Phone className="h-5 w-5" aria-hidden />
          Llamar
        </a>
      ) : null}
    </div>
  );
};
