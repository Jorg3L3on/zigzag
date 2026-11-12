import { APP_MUTED, APP_PIECE_CARD, TOUCH_RING_SM } from '@/components/ayuda/pieces/app-look';

export type PieceDockTab = 'Tickets' | 'Cobranza';

const PlusIcon = () => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
    <path d="M12 5v14M5 12h14" />
  </svg>
);

const Dock = ({ ring }: { ring: PieceDockTab | null }) => (
  <div className={`${APP_PIECE_CARD} flex items-center justify-around gap-1 rounded-full px-2 py-2.5 ${APP_MUTED}`}>
    <span>Hoy</span>
    {(['Tickets', null, 'Cobranza'] as const).map((tab) =>
      tab === null ? (
        <span key="plus" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#2563EB] text-white">
          <PlusIcon />
        </span>
      ) : (
        <span
          key={tab}
          className={tab === ring ? `rounded-full bg-[#DBEAFE] px-2.5 py-1.5 font-semibold text-[#0B1220] ${TOUCH_RING_SM}` : undefined}
        >
          {tab}
        </span>
      ),
    )}
    <span>Más</span>
  </div>
);

/** Phone dock (MobileBottomDock) with one tab ringed. */
export const DockTabPiece = ({ tab }: { tab: PieceDockTab }) => (
  <div aria-hidden className="flex w-full max-w-[340px] min-w-0 flex-col">
    <Dock ring={tab} />
  </div>
);
