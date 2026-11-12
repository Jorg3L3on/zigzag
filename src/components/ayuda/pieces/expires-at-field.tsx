import { APP_MUTED, APP_PIECE_CARD, TOUCH_RING_SM } from '@/components/ayuda/pieces/app-look';

const QUICK_DAYS = [7, 15, 30] as const;

type ExpiresAtFieldPieceProps = { days: (typeof QUICK_DAYS)[number]; dateLabel: string };

/** Vence (opcional) in Nuevo presupuesto (ExpiresAtField): the chosen chip ringed. */
export const ExpiresAtFieldPiece = ({ days, dateLabel }: ExpiresAtFieldPieceProps) => (
  <div aria-hidden className={`${APP_PIECE_CARD} flex min-w-0 flex-col gap-2.5 p-3.5`}>
    <span className="font-medium">
      Vence <span className={`font-normal ${APP_MUTED}`}>(opcional)</span>
    </span>
    <span className="grid grid-cols-3 gap-2">
      {QUICK_DAYS.map((option) => (
        <span
          key={option}
          className={`flex h-10 min-w-0 items-center justify-center rounded-xl border ${
            option === days ? `border-[#2563EB] bg-[#DBEAFE] font-semibold ${TOUCH_RING_SM}` : 'border-[#CBD5E1]'
          }`}
        >
          {option} días
        </span>
      ))}
    </span>
    <span className="flex min-h-11 items-center rounded-xl border border-[#CBD5E1] px-3 [overflow-wrap:anywhere]">
      Vence el {dateLabel} · en {days} días
    </span>
  </div>
);
