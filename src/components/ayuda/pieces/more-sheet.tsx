import {
  APP_MUTED,
  APP_PIECE_CARD,
  TOUCH_RING,
  TOUCH_RING_SM,
} from '@/components/ayuda/pieces/app-look';

type MoreSheetPieceProps = { items: string[]; highlight: string };

/**
 * Phone "Más" (the sidebar sheet over MobileBottomDock): a few of its entries
 * with the one to open ringed, and Más ringed in the dock below.
 */
export const MoreSheetPiece = ({ items, highlight }: MoreSheetPieceProps) => (
  <div aria-hidden className="flex w-full max-w-[340px] flex-col items-center gap-3">
    <div className={`${APP_PIECE_CARD} flex max-w-[260px] flex-col gap-0.5 p-2`}>
      {items.map((item) => (
        <span
          key={item}
          className={`rounded-xl px-3 py-2 ${
            item === highlight ? `bg-[#EFF6FF] font-semibold ${TOUCH_RING_SM}` : ''
          }`}
        >
          {item}
        </span>
      ))}
    </div>
    <div
      className={`${APP_PIECE_CARD} flex items-center justify-around rounded-full px-2 py-2.5 ${APP_MUTED}`}
    >
      <span>Hoy</span>
      <span>Tickets</span>
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#2563EB] text-lg font-semibold text-white">
        +
      </span>
      <span>Cobranza</span>
      <span className={`rounded-full px-2.5 py-1 font-semibold text-[#0B1220] ${TOUCH_RING}`}>
        Más
      </span>
    </div>
  </div>
);
