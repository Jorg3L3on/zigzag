import { APP_PIECE_CARD } from '@/components/ayuda/pieces/app-look';

const CloudIcon = () => (
  <svg
    viewBox="0 0 24 24"
    width="18"
    height="18"
    className="mt-0.5 shrink-0 text-[#2563EB]"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M7 18a4.5 4.5 0 0 1-.6-8.96A6 6 0 0 1 18 9.5a4 4 0 0 1-.5 8.5H7Z" />
  </svg>
);

/**
 * Working with no signal: the "Listo para trabajar sin señal" pill
 * (FieldSyncRunner), or the amber bar plus the composer notice.
 */
export const OfflineNoticePiece = ({ variant }: { variant: 'ready' | 'composer' }) => {
  if (variant === 'ready') {
    return (
      <div aria-hidden className="flex w-full max-w-[340px] justify-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-[#2563EB]/30 bg-white px-4 py-2 font-medium shadow-[0_18px_36px_-24px_rgba(23,20,15,0.45)]">
          <CloudIcon />
          Listo para trabajar sin señal
        </span>
      </div>
    );
  }
  return (
    <div aria-hidden className="flex w-full max-w-[340px] flex-col gap-3">
      <span className="rounded-xl border border-amber-300 bg-amber-100 px-3.5 py-2.5 text-amber-900">
        Sin conexión a internet. Algunas acciones pueden fallar.
      </span>
      <span
        className={`${APP_PIECE_CARD} flex items-start gap-2.5 border-[#2563EB]/30 bg-[#EFF6FF] px-3.5 py-3`}
      >
        <CloudIcon />
        <span>
          <strong className="font-semibold">Sin conexión.</strong> Guárdalo aquí: se sube solo
          cuando haya señal y ahí toma su folio. Mientras, es provisional (no es factura).
        </span>
      </span>
    </div>
  );
};
