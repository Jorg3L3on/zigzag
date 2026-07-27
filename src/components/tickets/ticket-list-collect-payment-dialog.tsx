'use client';

import * as React from 'react';
import { toast } from 'sonner';
import { applyTicketPayment } from '@/actions/tickets';
import { FormattedCurrency } from '@/components/formatted-currency';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { getErrorMessageByType } from '@/lib/network-awareness';
import {
  getTicketBalanceDue,
  getTicketPaymentStatus,
} from '@/lib/ticket-payment-status';
import { Loader2 } from 'lucide-react';

export type TicketListCollectPaymentResult = {
  ticketId: number;
  paid: number;
  total: number | null;
};

type TicketListCollectPaymentDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ticketId: number;
  total: number | null;
  paid: number | null;
  onPaymentApplied: (result: TicketListCollectPaymentResult) => void;
};

export const TicketListCollectPaymentDialog = ({
  open,
  onOpenChange,
  ticketId,
  total,
  paid,
  onPaymentApplied,
}: TicketListCollectPaymentDialogProps) => {
  const [amountInput, setAmountInput] = React.useState('');
  const [isPending, startTransition] = React.useTransition();

  const balanceDue = getTicketBalanceDue(total, paid);
  const paymentStatus = getTicketPaymentStatus(total, paid);

  React.useEffect(() => {
    if (!open) {
      setAmountInput('');
    }
  }, [open]);

  const parseAmount = (value: string): number => {
    if (!value.trim()) return 0;
    const parsed = Number.parseFloat(value);
    if (!Number.isFinite(parsed)) return 0;
    return Math.max(parsed, 0);
  };

  const handleSuccess = (nextPaid: number) => {
    onPaymentApplied({
      ticketId,
      paid: nextPaid,
      total,
    });
    onOpenChange(false);
    setAmountInput('');
  };

  const handleApplyPayment = () => {
    const additional = parseAmount(amountInput);
    if (additional <= 0) {
      toast.error('Ingresa un monto mayor a cero. Código: TC009');
      return;
    }
    if (additional > balanceDue + 1e-9) {
      toast.error('El monto no puede superar el saldo pendiente. Código: TC009');
      return;
    }

    startTransition(async () => {
      const result = await applyTicketPayment(ticketId, additional);
      if (result.success) {
        const row = result.data as { paid?: number | null } | undefined;
        const nextPaid =
          typeof row?.paid === 'number' ? row.paid : (paid ?? 0) + additional;
        toast.success('Cobro registrado correctamente');
        handleSuccess(nextPaid);
        return;
      }
      toast.error(
        getErrorMessageByType(
          result.errorType ?? 'server',
          result.error ?? 'No se pudo registrar el cobro',
        ),
      );
    });
  };

  const handleSettleFull = () => {
    if (balanceDue <= 0) return;

    startTransition(async () => {
      const result = await applyTicketPayment(ticketId, balanceDue);
      if (result.success) {
        const row = result.data as { paid?: number | null } | undefined;
        const nextPaid =
          typeof row?.paid === 'number' ? row.paid : (total ?? paid ?? 0);
        toast.success('Ticket saldado');
        handleSuccess(nextPaid);
        return;
      }
      toast.error(
        getErrorMessageByType(
          result.errorType ?? 'server',
          result.error ?? 'No se pudo saldar el ticket',
        ),
      );
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar pago</DialogTitle>
          <DialogDescription>
            Abona una parte del saldo o salda el ticket por completo.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 rounded-lg bg-muted/40 p-4 sm:grid-cols-3">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Total</p>
            <p className="font-medium tabular-nums">
              <FormattedCurrency amount={total} />
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Pagado</p>
            <p className="font-medium tabular-nums">
              <FormattedCurrency amount={paid ?? 0} />
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Por pagar</p>
            <p className="font-medium tabular-nums">
              <FormattedCurrency amount={balanceDue} />
            </p>
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          Estado actual:{' '}
          <span className="font-medium text-foreground">
            {paymentStatus === 'partial' ? 'Pago parcial' : 'Pendiente'}
          </span>
        </p>

        <div className="space-y-2">
          <label htmlFor={`list-ticket-payment-${ticketId}`} className="sr-only">
            Monto a abonar
          </label>
          <Input
            id={`list-ticket-payment-${ticketId}`}
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            disabled={isPending}
            value={amountInput}
            onChange={(event) => setAmountInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                handleApplyPayment();
              }
            }}
            aria-label="Monto a abonar"
            placeholder="Monto a abonar"
            className="h-11"
          />
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            type="button"
            variant="secondary"
            className="h-11"
            disabled={isPending || balanceDue <= 0}
            onClick={handleSettleFull}
            aria-label="Saldar el ticket por completo"
          >
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              'Saldar por completo'
            )}
          </Button>
          <Button
            type="button"
            className="h-11"
            disabled={isPending}
            onClick={handleApplyPayment}
            aria-label="Registrar abono al saldo del ticket"
          >
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              'Registrar abono'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
