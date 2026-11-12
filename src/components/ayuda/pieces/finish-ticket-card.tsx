import {
  APP_MUTED,
  APP_PIECE_CARD,
  formatPieceMoney,
  TOUCH_RING,
} from '@/components/ayuda/pieces/app-look';

const CHIPS = [
  { mode: 'full', label: 'Todo' },
  { mode: 'partial', label: 'Una parte' },
  { mode: 'pending', label: 'Nada aún' },
] as const;

type FinishTicketCardPieceProps = { total: number; chosen: 'full' | 'partial' | 'pending' };

/** Phone «Terminar ticket» card (TicketDetailFinishPanel) with the button ringed. */
export const FinishTicketCardPiece = ({ total, chosen }: FinishTicketCardPieceProps) => (
  <div aria-hidden className={`${APP_PIECE_CARD} flex min-w-0 flex-col gap-3 p-3.5`}>
    <span>
      <strong className="block font-semibold">Terminar ticket</strong>
      <span className={`block ${APP_MUTED}`}>Registra el pago inicial y genera el recibo</span>
    </span>
    <span className="font-medium tabular-nums">Total: {formatPieceMoney(total)}</span>
    <div className="flex gap-1.5">
      {CHIPS.map((chip) => (
        <span
          key={chip.mode}
          className={`flex h-11 min-w-0 flex-1 items-center justify-center rounded-[10px] border-[1.5px] px-0.5 ${
            chip.mode === chosen ? 'border-[#2563EB] bg-[#DBEAFE] font-semibold' : 'border-[#E2E8F0]'
          }`}
        >
          {chip.label}
        </span>
      ))}
    </div>
    <span
      className={`flex min-h-12 items-center justify-center rounded-xl bg-[#2563EB] px-3 text-center font-semibold text-white ${TOUCH_RING}`}
    >
      Terminar y generar recibo
    </span>
  </div>
);
