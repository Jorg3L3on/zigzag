'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import { ConfirmSheet } from '@/components/documents/confirm-sheet';
import { MoneyFigure } from '@/components/documents/money-figure';
import { useReceiptShare } from '@/components/tickets/use-receipt-share';
import { usePermissions } from '@/hooks/use-permissions';
import { subtractMoney } from '@/lib/money';
import { canDownloadTicketInvoice } from '@/lib/tickets-rbac';

type TicketDetailResendPromptProps = {
  ticketId: number;
  /** Company folio shown in share titles and messages. */
  folio?: string | null;
  clientName: string | null;
  clientTel: string | null;
  total: number | null;
  paid: number | null;
  downloadFileName: string;
};

/**
 * Offers to send the recibo when the detail opens right after a change:
 * `?enviar=1` after Guardar y terminar in Nuevo ticket (ZIG-I24-4), and
 * `?reenviar=1` after editing a finalized ticket whose total changed
 * (ZIG-I13-6). Sharing starts from the tap, so the share sheet always opens.
 * Ahora no just closes it.
 */
export const TicketDetailResendPrompt = ({
  ticketId,
  folio = null,
  clientName,
  clientTel,
  total,
  paid,
  downloadFileName,
}: TicketDetailResendPromptProps) => {
  const router = useRouter();
  const params = useSearchParams();
  const { can } = usePermissions();
  const [dismissed, setDismissed] = React.useState(false);
  const { share, sharing } = useReceiptShare({
    ticketId: String(ticketId),
    folio,
    downloadFileName,
    clientName,
    clientTel,
    total: total ?? 0,
  });

  const mode =
    params.get('enviar') === '1' ? 'send' : params.get('reenviar') === '1' ? 'resend' : null;
  const open = mode !== null && !dismissed && canDownloadTicketInvoice(can);
  const balance = subtractMoney(total ?? 0, paid ?? 0);

  const close = () => {
    setDismissed(true);
    router.replace(`/tickets/${ticketId}`, { scroll: false });
  };

  return (
    <ConfirmSheet
      open={open}
      onOpenChange={(next) => {
        if (!next && !sharing) close();
      }}
      title={
        mode === 'send'
          ? `Ticket ${folio ?? `#${ticketId}`} terminado`
          : '¿Reenviar el recibo nuevo?'
      }
      description={
        mode === 'send'
          ? '¿Le envías el recibo a tu cliente?'
          : 'El total cambió. Comparte el recibo actualizado con tu cliente.'
      }
      summary={
        mode === 'send' ? (
          <dl className="space-y-1.5 rounded-xl border border-border/60 bg-muted/30 p-3 text-sm">
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-muted-foreground">Total</dt>
              <dd>
                <MoneyFigure amount={total ?? 0} size="md" />
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-muted-foreground">Pagado</dt>
              <dd>
                <MoneyFigure amount={paid ?? 0} size="md" />
              </dd>
            </div>
            {balance > 0 ? (
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-muted-foreground">Saldo por cobrar</dt>
                <dd>
                  <MoneyFigure amount={balance} size="md" />
                </dd>
              </div>
            ) : null}
          </dl>
        ) : (
          <p className="flex items-baseline justify-between gap-3 rounded-xl border border-border/60 bg-muted/30 p-3 text-sm">
            <span className="text-muted-foreground">Nuevo total</span>
            <MoneyFigure amount={total ?? 0} size="md" />
          </p>
        )
      }
      confirmLabel={mode === 'send' ? 'Enviar recibo' : 'Reenviar recibo'}
      cancelLabel="Ahora no"
      destructive={false}
      pending={sharing}
      onConfirm={async () => {
        await share(paid ?? 0);
        close();
      }}
    />
  );
};
