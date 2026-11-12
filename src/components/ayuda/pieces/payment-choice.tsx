'use client';

import { useId, useState } from 'react';
import { APP_PIECE_CARD } from '@/components/ayuda/pieces/app-look';

export type PiecePayMode = 'full' | 'partial' | 'pending';

/** Same labels and order as the composer chips (PaymentChoice, ZIG-I13-3). */
const OPTIONS: Array<{ mode: PiecePayMode; label: string }> = [
  { mode: 'full', label: 'Todo' },
  { mode: 'partial', label: 'Una parte' },
  { mode: 'pending', label: 'Nada aún' },
];

type PaymentChoicePieceProps = {
  initial: PiecePayMode;
  explanations: Record<PiecePayMode, string>;
};

/**
 * "¿Cómo pagó el cliente?" to try on the page: picking an option reads back
 * what happens to the ticket. Nothing is saved or sent.
 */
export const PaymentChoicePiece = ({ initial, explanations }: PaymentChoicePieceProps) => {
  const [mode, setMode] = useState<PiecePayMode>(initial);
  const headingId = useId();
  return (
    <div className={`${APP_PIECE_CARD} flex flex-col gap-2.5 p-3.5`}>
      <strong id={headingId} className="font-semibold">
        ¿Cómo pagó el cliente?
      </strong>
      <div role="group" aria-labelledby={headingId} className="flex gap-1.5">
        {OPTIONS.map((option) => {
          const selected = option.mode === mode;
          return (
            <button
              key={option.mode}
              type="button"
              aria-pressed={selected}
              onClick={() => setMode(option.mode)}
              className={`h-12 min-w-0 flex-1 cursor-pointer rounded-[10px] border-[1.5px] px-0.5 text-sm text-[#0B1220] ${
                selected
                  ? 'border-[#2563EB] bg-[#DBEAFE] font-semibold'
                  : 'border-[#E2E8F0] bg-white font-normal'
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
      <p
        aria-live="polite"
        data-testid="ayuda-pay-explanation"
        className="m-0 rounded-[10px] bg-[#F1F5F9] px-3 py-2.5 text-[#334155]"
      >
        {explanations[mode]}
      </p>
    </div>
  );
};
