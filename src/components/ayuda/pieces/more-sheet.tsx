import { APP_PIECE_CARD, TOUCH_RING_SM } from '@/components/ayuda/pieces/app-look';
import { Dock } from '@/components/ayuda/pieces/mobile-dock';

type MoreSheetPieceProps = { items: string[]; highlight: string };

/**
 * Phone "Más" (the sidebar sheet over MobileBottomDock): a few of its entries
 * with the one to open ringed, and Más ringed in the dock below.
 */
export const MoreSheetPiece = ({ items, highlight }: MoreSheetPieceProps) => (
  <div aria-hidden className="flex w-full max-w-[340px] min-w-0 flex-col items-center gap-3">
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
    <Dock ring="Más" />
  </div>
);
