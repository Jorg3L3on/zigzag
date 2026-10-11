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
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { useIsMobile } from '@/hooks/use-mobile';
import { formatServiceCurrency } from '@/components/tickets/ticket-services-utils';
import { getErrorMessageByType } from '@/lib/network-awareness';
import { vibrateSuccess } from '@/lib/vibrate-success';
import { getTicketBalanceDue } from '@/lib/ticket-payment-status';
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
  companyId?: number | null;
  onPaymentApplied: (result: TicketListCollectPaymentResult) => void;
};

/** Round amounts below the balance, plus half of it: "mitad", $500, $1,000... */
export const getCollectQuickAmounts = (
  balanceDue: number,
): { label: string; amount: number }[] => {
  const chips: { label: string; amount: number }[] = [];
  const half = Math.round((balanceDue / 2) * 100) / 100;
  if (half > 0 && balanceDue > 1) chips.push({ label: 'La mitad', amount: half });
  for (const round of [500, 1000, 2000]) {
    if (round < balanceDue && Math.abs(round - half) > 1e-9) {
      chips.push({ label: formatServiceCurrency(round).replace('.00', ''), amount: round });
    }
  }
  return chips.slice(0, 3);
};

export const TicketListCollectPaymentDialog = ({
  open,
  onOpenChange,
  ticketId,
  total,
  paid,
  companyId = null,
  onPaymentApplied,
}: TicketListCollectPaymentDialogProps) => {
  const isMobile = useIsMobile();
  const [partial, setPartial] = React.useState(false);
  const [amountInput, setAmountInput] = React.useState('');
  const [amountError, setAmountError] = React.useState<string | null>(null);
  const [isPending, startTransition] = React.useTransition();

  const balanceDue = getTicketBalanceDue(total, paid);

  React.useEffect(() => {
    if (!open) {
      setPartial(false);
      setAmountInput('');
      setAmountError(null);
    }
  }, [open]);

  const parseAmount = (value: string): number => {
    const parsed = Number.parseFloat(value.replace(/[,\s$]/g, ''));
    if (!Number.isFinite(parsed)) return 0;
    return Math.max(parsed, 0);
  };

  const handleSuccess = (nextPaid: number) => {
    onPaymentApplied({ ticketId, paid: nextPaid, total });
    onOpenChange(false);
  };

  const submit = (amount: number, fullyPaid: boolean) => {
    startTransition(async () => {
      const result = await applyTicketPayment(ticketId, amount, companyId);
      if (result.success) {
        const row = result.data as { paid?: number | null } | undefined;
        const nextPaid =
          typeof row?.paid === 'number'
            ? row.paid
            : fullyPaid
              ? (total ?? paid ?? 0)
              : (paid ?? 0) + amount;
        vibrateSuccess();
        toast.success(fullyPaid ? 'Listo, quedó pagado' : 'Cobro anotado');
        handleSuccess(nextPaid);
        return;
      }
      toast.error(
        getErrorMessageByType(
          result.errorType ?? 'server',
          result.error ?? 'No se pudo anotar el cobro',
        ),
      );
    });
  };

  const handlePayAll = () => {
    if (balanceDue <= 0) return;
    submit(balanceDue, true);
  };

  const handlePayPart = () => {
    const additional = parseAmount(amountInput);
    if (additional <= 0) {
      setAmountError('Escribe cuánto te pagó.');
      return;
    }
    if (additional > balanceDue + 1e-9) {
      setAmountError(
        `Es más de lo que debe. Le faltan ${formatServiceCurrency(balanceDue)}.`,
      );
      return;
    }
    setAmountError(null);
    submit(additional, additional >= balanceDue - 1e-9);
  };

  const chips = getCollectQuickAmounts(balanceDue);

  const content = (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3 rounded-lg bg-muted/40 p-4">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">Total</p>
          <p className="font-medium tabular-nums">
            <FormattedCurrency amount={total} />
          </p>
        </div>
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">Pagado</p>
          <p className="font-medium tabular-nums">
            <FormattedCurrency amount={paid ?? 0} />
          </p>
        </div>
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">Por pagar</p>
          <p className="font-medium tabular-nums">
            <FormattedCurrency amount={balanceDue} />
          </p>
        </div>
      </div>

      <Button
        type="button"
        className="h-14 w-full rounded-xl text-base font-semibold"
        disabled={isPending || balanceDue <= 0}
        onClick={handlePayAll}
      >
        {isPending && !partial ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        ) : (
          <>Pagó todo · {formatServiceCurrency(balanceDue)}</>
        )}
      </Button>

      {partial ? (
        <div className="space-y-3 rounded-xl border p-4">
          <label
            htmlFor={`list-ticket-payment-${ticketId}`}
            className="block text-base font-medium"
          >
            ¿Cuánto pagó?
          </label>
          <div className="relative">
            <span
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-base text-muted-foreground"
              aria-hidden
            >
              $
            </span>
            <Input
              id={`list-ticket-payment-${ticketId}`}
              type="text"
              inputMode="decimal"
              autoFocus
              disabled={isPending}
              value={amountInput}
              onChange={(event) => {
                setAmountInput(event.target.value);
                setAmountError(null);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  handlePayPart();
                }
              }}
              placeholder="0.00"
              aria-invalid={amountError ? true : undefined}
              aria-describedby={amountError ? `list-ticket-payment-err-${ticketId}` : undefined}
              className="h-12 pl-7 text-base"
            />
          </div>
          {chips.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {chips.map((chip) => (
                <Button
                  key={chip.label}
                  type="button"
                  variant="outline"
                  className="h-11 rounded-full px-4 text-base"
                  disabled={isPending}
                  onClick={() => {
                    setAmountInput(String(chip.amount));
                    setAmountError(null);
                  }}
                >
                  {chip.label}
                </Button>
              ))}
            </div>
          ) : null}
          {amountError ? (
            <p
              id={`list-ticket-payment-err-${ticketId}`}
              role="alert"
              className="text-sm text-destructive"
            >
              {amountError}
            </p>
          ) : null}
          <Button
            type="button"
            variant="secondary"
            className="h-12 w-full rounded-xl text-base"
            disabled={isPending}
            onClick={handlePayPart}
          >
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              'Anotar este pago'
            )}
          </Button>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          className="h-12 w-full rounded-xl text-base"
          disabled={isPending}
          onClick={() => setPartial(true)}
        >
          Pagó una parte
        </Button>
      )}
    </div>
  );

  const title = 'Cobrar';
  const description = 'Elige cuánto te pagó el cliente.';

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          className="max-h-[90dvh] overflow-y-auto rounded-t-2xl pb-[max(1.5rem,env(safe-area-inset-bottom))]"
          data-testid="collect-payment-sheet"
        >
          <SheetHeader className="pr-10 text-left">
            <SheetTitle>{title}</SheetTitle>
            <SheetDescription>{description}</SheetDescription>
          </SheetHeader>
          <div className="mt-4">{content}</div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="collect-payment-sheet">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {content}
      </DialogContent>
    </Dialog>
  );
};
