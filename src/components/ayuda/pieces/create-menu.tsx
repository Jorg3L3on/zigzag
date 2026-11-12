import {
  APP_MUTED,
  APP_PIECE_CARD,
  TOUCH_RING_SM,
} from '@/components/ayuda/pieces/app-look';
import { MOBILE_CREATE_ACTIONS } from '@/lib/nav-items';

const PlusIcon = () => (
  <svg
    viewBox="0 0 24 24"
    width="22"
    height="22"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.4"
    strokeLinecap="round"
  >
    <path d="M12 5v14M5 12h14" />
  </svg>
);

/**
 * The menu behind the dock + (MobileBottomDock, MOBILE_CREATE_ACTIONS): every
 * entry with its hint, the one the step asks for ringed, the + under it.
 */
export const CreateMenuPiece = ({ highlight }: { highlight: string }) => (
  <div aria-hidden className="flex w-full max-w-[340px] flex-col items-center gap-3">
    <div className={`${APP_PIECE_CARD} flex max-w-[260px] flex-col gap-1 p-2`}>
      {MOBILE_CREATE_ACTIONS.map((action) => (
        <span
          key={action.title}
          className={`flex flex-col rounded-xl px-3 py-2 ${
            action.title === highlight ? `bg-[#EFF6FF] ${TOUCH_RING_SM}` : ''
          }`}
        >
          <span className="font-semibold">{action.title}</span>
          <span className={APP_MUTED}>{action.hint}</span>
        </span>
      ))}
    </div>
    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#2563EB] text-white">
      <PlusIcon />
    </span>
  </div>
);
