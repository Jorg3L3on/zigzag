import { APP_MUTED, APP_PIECE_CARD, TOUCH_RING_SM } from '@/components/ayuda/pieces/app-look';

export type PieceDockTab = 'Tickets' | 'Cobranza';
type DockLabel = 'Hoy' | PieceDockTab | 'Más';

const PlusIcon = () => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
    <path d="M12 5v14M5 12h14" />
  </svg>
);

/** Phone dock (MobileBottomDock): Hoy, Tickets, +, Cobranza, Más, with one label ringed. */
export const Dock = ({ ring }: { ring: DockLabel | null }) => (
  <div className={`${APP_PIECE_CARD} flex items-center justify-around gap-1 rounded-full px-2 py-2.5 ${APP_MUTED}`}>
    {(['Hoy', 'Tickets', null, 'Cobranza', 'Más'] as const).map((label) =>
      label === null ? (
        <span key="plus" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#2563EB] text-white">
          <PlusIcon />
        </span>
      ) : (
        <span
          key={label}
          className={label === ring ? `rounded-full bg-[#DBEAFE] px-2 py-1.5 font-semibold text-[#0B1220] ${TOUCH_RING_SM}` : undefined}
        >
          {label}
        </span>
      ),
    )}
  </div>
);

/** Phone dock (MobileBottomDock) with one tab ringed. */
export const DockTabPiece = ({ tab }: { tab: PieceDockTab }) => (
  <div aria-hidden className="flex w-full max-w-[340px] min-w-0 flex-col">
    <Dock ring={tab} />
  </div>
);
