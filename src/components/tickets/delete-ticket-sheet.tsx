'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import { deleteTicket } from '@/actions/tickets';
import { ConfirmSheet } from '@/components/documents/confirm-sheet';
import { formatServiceCurrency } from '@/components/tickets/ticket-services-utils';
import {
  classifyClientError,
  getErrorMessageByType,
} from '@/lib/network-awareness';

type DeleteTicketSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ticketId: number;
  clientName: string | null;
  total: number | null;
  /** Payments already recorded: deleting hides them too. */
  paymentsCount: number;
  paymentsTotal: number;
  companyId?: number | null;
  /** Where to go once deleted; default the tickets list. */
  afterDeleteHref?: string;
};

/**
 * "¿Eliminar el ticket #N?" (ZIG-I13-4): names what goes away, the client, the
 * total and the payments on record, and makes no promise of a papelera the
 * tenant cannot open (Papelera is system-only).
 */
export const DeleteTicketSheet = ({
  open,
  onOpenChange,
  ticketId,
  clientName,
  total,
  paymentsCount,
  paymentsTotal,
  companyId = null,
  afterDeleteHref = '/tickets',
}: DeleteTicketSheetProps) => {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);

  const handleConfirm = async () => {
    if (pending) return;
    setPending(true);
    try {
      const result = await deleteTicket(ticketId, companyId);
      if (result.success) {
        toast.success(`Ticket #${ticketId} eliminado`);
        onOpenChange(false);
        router.push(afterDeleteHref);
        router.refresh();
        return;
      }
      const errorType = classifyClientError(null, undefined, result.errorType);
      toast.error(
        getErrorMessageByType(errorType, result.error || 'Error al eliminar el ticket'),
      );
    } catch (error) {
      toast.error(
        getErrorMessageByType(classifyClientError(error), 'Error al eliminar el ticket'),
      );
    } finally {
      setPending(false);
    }
  };

  return (
    <ConfirmSheet
      open={open}
      onOpenChange={onOpenChange}
      title={`¿Eliminar el ticket #${ticketId}?`}
      description="Desaparece de tus tickets y de cobranza. No podrás recuperarlo tú; solo soporte puede restaurarlo."
      summary={
        <dl
          className="space-y-1 rounded-xl border border-border/60 bg-muted/30 p-3 text-sm"
          data-testid="delete-ticket-summary"
        >
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Cliente</dt>
            <dd className="min-w-0 text-right font-medium [overflow-wrap:anywhere]">
              {clientName || 'Sin nombre'}
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Total</dt>
            <dd className="text-right font-medium tabular-nums [overflow-wrap:anywhere]">
              {formatServiceCurrency(total ?? 0)}
            </dd>
          </div>
          {paymentsCount > 0 ? (
            <p className="pt-1 text-amber-700 dark:text-amber-300">
              Tiene {paymentsCount === 1 ? '1 pago registrado' : `${paymentsCount} pagos registrados`}{' '}
              por {formatServiceCurrency(paymentsTotal)}.
            </p>
          ) : null}
        </dl>
      }
      confirmLabel="Eliminar ticket"
      cancelLabel="Conservar"
      onConfirm={handleConfirm}
      pending={pending}
    />
  );
};
