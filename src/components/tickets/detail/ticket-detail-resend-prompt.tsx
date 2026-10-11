'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import { ConfirmSheet } from '@/components/documents/confirm-sheet';
import { MoneyFigure } from '@/components/documents/money-figure';
import { useReceiptShare } from '@/components/tickets/use-receipt-share';
import { usePermissions } from '@/hooks/use-permissions';
import { canDownloadTicketInvoice } from '@/lib/tickets-rbac';

type TicketDetailResendPromptProps = {
  ticketId: number;
  clientName: string | null;
  clientTel: string | null;
  total: number | null;
  paid: number | null;
  downloadFileName: string;
};

/**
 * After saving a finalized ticket whose total changed (`?reenviar=1`), offers to
 * send the new recibo (ZIG-I13-6). Ahora no just closes it.
 */
export const TicketDetailResendPrompt = ({
  ticketId,
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
    downloadFileName,
    clientName,
    clientTel,
    total: total ?? 0,
  });

  const open = params.get('reenviar') === '1' && !dismissed && canDownloadTicketInvoice(can);

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
      title="¿Reenviar el recibo nuevo?"
      description="El total cambió. Comparte el recibo actualizado con tu cliente."
      summary={
        <p className="flex items-baseline justify-between gap-3 rounded-xl border border-border/60 bg-muted/30 p-3 text-sm">
          <span className="text-muted-foreground">Nuevo total</span>
          <MoneyFigure amount={total ?? 0} size="md" />
        </p>
      }
      confirmLabel="Reenviar recibo"
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
