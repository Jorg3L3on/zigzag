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
import { FILTER_SELECTED_CLASS } from '@/components/list-page';
import { cn } from '@/lib/utils';
import { buildWhatsAppReceiptShare } from '@/lib/whatsapp-share';
import { Loader2, Wallet } from 'lucide-react';

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
  /** Desktop title «Cobrar ticket R-0016»; plain «Cobrar» without it (folio, never the id). */
  folio?: string | null;
  clientName?: string | null;
  /** With a phone, settling the ticket offers «Enviar recibo» by WhatsApp. */
  clientTel?: string | null;
  companyName?: string | null;
  /** Desktop: the second line of the «Listo, quedó pagado» toast (Cobranza says what moved). */
  settledDescription?: string;
};

/** Desktop shortcuts (ZIG-I31-3): the whole saldo by default, half, or another amount. */
export type CollectShortcut = 'all' | 'half' | 'other';

const halfOf = (amount: number): number => Math.round((amount / 2) * 100) / 100;

/** Amount text for the field, grouped like the canvas (`421,582.39`); cents only when there are any. */
const amountInputValue = (amount: number): string =>
  amount.toLocaleString('es-MX', {
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    maximumFractionDigits: 2,
  });

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
  folio = null,
  clientName = null,
  clientTel = null,
  companyName = null,
  settledDescription,
}: TicketListCollectPaymentDialogProps) => {
  const isMobile = useIsMobile();
  const [partial, setPartial] = React.useState(false);
  const [amountInput, setAmountInput] = React.useState('');
  const [amountError, setAmountError] = React.useState<string | null>(null);
  const [shortcut, setShortcut] = React.useState<CollectShortcut>('all');
  const [isPending, startTransition] = React.useTransition();
  const desktopAmountRef = React.useRef<HTMLInputElement>(null);

  const balanceDue = getTicketBalanceDue(total, paid);

  React.useEffect(() => {
    if (!open) {
      setPartial(false);
      setAmountInput('');
      setAmountError(null);
      setShortcut('all');
    } else if (!isMobile) {
      // Desktop starts with the whole saldo in the field.
      setAmountInput(amountInputValue(balanceDue));
    }
  }, [open, isMobile, balanceDue]);

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
        const receipt =
          fullyPaid && !isMobile && total != null
            ? buildWhatsAppReceiptShare({
                phone: clientTel,
                clientName,
                ticketId,
                folio,
                total,
                paid: nextPaid,
                companyName,
              })
            : null;
        if (receipt) {
          toast.success('Listo, quedó pagado', {
            description: settledDescription,
            action: {
              label: 'Enviar recibo',
              onClick: () => {
                window.open(receipt.href, '_blank', 'noopener,noreferrer');
              },
            },
          });
        } else if (fullyPaid && !isMobile && settledDescription) {
          toast.success('Listo, quedó pagado', { description: settledDescription });
        } else {
          toast.success(fullyPaid ? 'Listo, quedó pagado' : 'Cobro anotado');
        }
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

  const pickShortcut = (next: CollectShortcut) => {
    setShortcut(next);
    setAmountError(null);
    if (next === 'all') setAmountInput(amountInputValue(balanceDue));
    if (next === 'half') setAmountInput(amountInputValue(halfOf(balanceDue)));
    if (next === 'other') {
      setAmountInput('');
      window.requestAnimationFrame(() => desktopAmountRef.current?.focus());
    }
  };


  const desktopContent = (
    <form
      className="mt-2"
      onSubmit={(event) => {
        event.preventDefault();
        handlePayPart();
      }}
    >
      <div className="flex items-baseline justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300">
        <span className="text-caption lg:text-[13px]/[inherit]">Saldo pendiente</span>
        <span className="text-base font-semibold tabular-nums">
          <FormattedCurrency amount={balanceDue} />
        </span>
      </div>

      <div className="mt-3.5">
        <label
          htmlFor={`list-ticket-payment-desktop-${ticketId}`}
          className="mb-1.5 block text-caption lg:text-[13px]/[inherit] font-medium text-slate-700 dark:text-slate-300"
        >
          ¿Cuánto pagó?
        </label>
        <div className="relative">
          <span
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-xl text-muted-foreground"
            aria-hidden
          >
            $
          </span>
          <Input
            ref={desktopAmountRef}
            id={`list-ticket-payment-desktop-${ticketId}`}
            type="text"
            inputMode="decimal"
            disabled={isPending}
            value={amountInput}
            onChange={(event) => {
              setAmountInput(event.target.value);
              setAmountError(null);
              setShortcut('other');
            }}
            placeholder="0.00"
            aria-invalid={amountError ? true : undefined}
            aria-describedby={`list-ticket-payment-note-${ticketId}${amountError ? ` list-ticket-payment-err-${ticketId}` : ''}`}
            className="h-12 rounded-[10px] pl-8 text-xl font-semibold tabular-nums"
          />
        </div>
      </div>

      <div role="radiogroup" aria-label="Cuánto te pagó" className="mt-2.5 flex flex-wrap gap-1.5">
        {(
          [
            { value: 'all', label: 'Todo el saldo' },
            { value: 'half', label: `La mitad · ${formatServiceCurrency(halfOf(balanceDue))}` },
            { value: 'other', label: 'Otro monto' },
          ] as const
        ).map((option) => {
          const checked = shortcut === option.value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={checked}
              disabled={isPending || (option.value === 'half' && balanceDue <= 1)}
              onClick={() => pickShortcut(option.value)}
              className={cn(
                'h-[34px] rounded-full border px-3 text-caption lg:text-[13px]/[inherit] font-medium tabular-nums outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50',
                checked
                  ? FILTER_SELECTED_CLASS
                  : 'border-border text-slate-700 hover:bg-muted/50 dark:text-slate-300',
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      {amountError ? (
        <p
          id={`list-ticket-payment-err-${ticketId}`}
          role="alert"
          className="mt-2 text-sm text-destructive"
        >
          {amountError}
        </p>
      ) : null}
      <p
        id={`list-ticket-payment-note-${ticketId}`}
        className="mt-3 text-caption leading-[1.45] lg:text-xs text-muted-foreground"
      >
        Con todo el saldo el ticket queda{' '}
        <b className="font-semibold text-emerald-700 dark:text-emerald-400">Pagado</b> y se ofrece
        enviar el recibo por WhatsApp. Un monto menor lo deja en Pago parcial.
      </p>

      <div className="mt-4 flex justify-end gap-2">
        <Button type="button" variant="outline" disabled={isPending} onClick={() => onOpenChange(false)}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isPending || balanceDue <= 0}>
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Wallet className="h-4 w-4" aria-hidden data-icon="inline-start" />
          )}
          Anotar cobro
        </Button>
      </div>
    </form>
  );

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
          <DialogTitle>{folio?.trim() ? `Cobrar ticket ${folio.trim()}` : title}</DialogTitle>
          <DialogDescription>{clientName?.trim() || description}</DialogDescription>
        </DialogHeader>
        {desktopContent}
      </DialogContent>
    </Dialog>
  );
};
