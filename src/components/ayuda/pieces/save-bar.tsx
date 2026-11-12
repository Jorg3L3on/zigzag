import {
  APP_MUTED,
  APP_PIECE_CARD,
  formatPieceMoney,
  TOUCH_RING,
} from '@/components/ayuda/pieces/app-look';

type SaveBarPieceProps = { countLabel: string; total: number; label: string };

/** Composer sticky bar on the phone: what is in the ticket, the total and Guardar (ringed). */
export const SaveBarPiece = ({ countLabel, total, label }: SaveBarPieceProps) => (
  <div
    aria-hidden
    className={`${APP_PIECE_CARD} flex items-center justify-between gap-2.5 px-3 py-2.5`}
  >
    <span className="flex min-w-0 flex-col">
      <span className={`text-sm ${APP_MUTED}`}>{countLabel}</span>
      <strong className="text-base tabular-nums">{formatPieceMoney(total)}</strong>
    </span>
    <span
      className={`inline-flex h-12 shrink-0 items-center rounded-xl bg-[#2563EB] px-6 font-semibold text-white ${TOUCH_RING}`}
    >
      {label}
    </span>
  </div>
);
