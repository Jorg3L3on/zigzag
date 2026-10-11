'use client';

import * as React from 'react';

import { GLASS_CARD_CLASS } from '@/components/toolbar-glass';
import { roundMoney } from '@/lib/money';
import { cn } from '@/lib/utils';

export type PayMode = 'full' | 'partial' | 'pending';

const PAY_OPTIONS: Array<{ mode: PayMode; label: string }> = [
  { mode: 'full', label: 'Todo' },
  { mode: 'partial', label: 'Una parte' },
  { mode: 'pending', label: 'Nada aún' },
];

export const parsePaymentAmount = (value: string): number => {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? Math.max(roundMoney(parsed), 0) : 0;
};

/**
 * State of "¿Cómo pagó el cliente?" (ZIG-I13-3/4): no default, so finalizing
 * never records a payment the user did not choose (ZIG-I12 Q2).
 */
export const usePaymentChoice = (total: number) => {
  const [payMode, setPayMode] = React.useState<PayMode | null>(null);
  const [partialInput, setPartialInput] = React.useState('');
  const chosenPaid =
    payMode === 'full' ? total : payMode === 'partial' ? parsePaymentAmount(partialInput) : 0;
  const partialTooHigh = payMode === 'partial' && chosenPaid > total;
  const hasPayChoice =
    payMode === 'full' ||
    payMode === 'pending' ||
    (payMode === 'partial' && chosenPaid > 0);
  return {
    payMode,
    setPayMode,
    partialInput,
    setPartialInput,
    chosenPaid,
    partialTooHigh,
    hasPayChoice,
  };
};

export type PaymentChoiceState = ReturnType<typeof usePaymentChoice>;

type PaymentChoiceProps = {
  choice: PaymentChoiceState;
  /** Unique per screen so the input id never collides. */
  idPrefix?: string;
  className?: string;
};

/**
 * Todo / Una parte / Nada aún, and Cuánto pagó for Una parte. Shared by the
 * listo screen and the finish panel of the ticket detail, so a converted,
 * unfinalized ticket asks the same question (ZIG-I13-4).
 */
export const PaymentChoice = ({
  choice,
  idPrefix = 'review',
  className,
}: PaymentChoiceProps) => {
  const { payMode, setPayMode, partialInput, setPartialInput, partialTooHigh } = choice;
  const headingId = `${idPrefix}-pay-heading`;
  const inputId = `${idPrefix}-paid-amount`;
  return (
    <section
      aria-labelledby={headingId}
      className={cn(GLASS_CARD_CLASS, 'space-y-3', className)}
    >
      <h2 id={headingId} className="text-[15px] font-semibold">
        ¿Cómo pagó el cliente?
      </h2>
      <div role="radiogroup" aria-labelledby={headingId} className="flex gap-2">
        {PAY_OPTIONS.map((option) => {
          const selected = payMode === option.mode;
          return (
            <button
              key={option.mode}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => setPayMode(option.mode)}
              className={cn(
                'h-12 min-w-0 flex-1 rounded-[10px] border px-1 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                selected
                  ? 'border-primary bg-primary/15 font-semibold'
                  : 'border-border bg-background hover:bg-muted/50',
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>
      {payMode === null ? (
        <p className="text-xs text-muted-foreground" data-testid="review-pay-hint">
          Elige cómo pagó el cliente para finalizar.
        </p>
      ) : null}
      {payMode === 'partial' ? (
        <div className="space-y-1.5">
          <label htmlFor={inputId} className="text-[13px] text-muted-foreground">
            Cuánto pagó
          </label>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
              $
            </span>
            <input
              id={inputId}
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={partialInput}
              onChange={(event) => setPartialInput(event.target.value)}
              className="h-12 w-full rounded-[10px] border border-primary bg-background pl-8 pr-3 text-base tabular-nums"
              placeholder="0.00"
            />
          </div>
          {partialTooHigh ? (
            <p className="text-xs text-destructive" role="alert">
              No puede ser mayor que el total.
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
};
