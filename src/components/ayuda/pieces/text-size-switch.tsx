'use client';

import { useId, useState } from 'react';
import { APP_MUTED, APP_PIECE_CARD, TOUCH_RING_SM } from '@/components/ayuda/pieces/app-look';

/**
 * "Texto grande" row of Más (TextSizeSwitch) to try on the page: the sample
 * under it grows from 16 to 18 px like the app does. Only this piece changes.
 */
export const TextSizeSwitchPiece = ({ initial }: { initial: boolean }) => {
  const [large, setLarge] = useState(initial);
  const id = useId();
  return (
    <div className={`${APP_PIECE_CARD} flex flex-col gap-3 p-3.5`}>
      <div className="flex min-h-11 items-center justify-between gap-3">
        <label htmlFor={id} className="flex-1 py-2 text-base font-medium">
          Texto grande
        </label>
        <button
          id={id}
          type="button"
          role="switch"
          aria-checked={large}
          onClick={() => setLarge((value) => !value)}
          className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full transition-colors ${
            large ? 'bg-[#2563EB]' : 'bg-[#CBD5E1]'
          } ${TOUCH_RING_SM}`}
        >
          <span
            className={`inline-block h-6 w-6 rounded-full bg-white shadow transition-transform ${
              large ? 'translate-x-[22px]' : 'translate-x-0.5'
            }`}
          />
        </button>
      </div>
      <div
        data-testid="ayuda-text-size-sample"
        data-size={large ? 'large' : 'normal'}
        className={`flex flex-col gap-0.5 rounded-xl border border-[#E2E8F0] px-3 py-2.5 ${
          large ? 'text-[18px]' : 'text-[16px]'
        }`}
      >
        <strong className="font-semibold">Hotel Riviera Dorada</strong>
        <span className={APP_MUTED}>Mantenimiento preventivo A/C · $850.00</span>
      </div>
    </div>
  );
};
