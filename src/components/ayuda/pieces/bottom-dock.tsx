import { APP_MUTED, APP_PIECE_CARD, TOUCH_RING } from '@/components/ayuda/pieces/app-look';

/**
 * Phone dock (MobileBottomDock): Hoy · Tickets · + · Cobranza · Más, with the
 * + ringed and the Crear menu it opens shown above it.
 */
export const BottomDockPiece = () => (
  <div aria-hidden className="flex w-full max-w-[340px] flex-col items-center gap-3">
    <div className={`${APP_PIECE_CARD} max-w-[240px] px-3.5 py-3`}>
      <span className="block font-semibold">Nuevo ticket</span>
      <span className={`block ${APP_MUTED}`}>Cliente, servicios y recibo</span>
    </div>
    <div
      className={`${APP_PIECE_CARD} flex items-center justify-around rounded-full px-2 py-2.5 ${APP_MUTED}`}
    >
      <span>Hoy</span>
      <span>Tickets</span>
      <span
        className={`flex h-12 w-12 items-center justify-center rounded-full bg-[#2563EB] text-white ${TOUCH_RING}`}
      >
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
      </span>
      <span>Cobranza</span>
      <span>Más</span>
    </div>
  </div>
);
