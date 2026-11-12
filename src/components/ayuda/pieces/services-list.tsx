import {
  APP_MUTED,
  APP_PIECE_CARD,
  formatPieceMoney,
  TOUCH_RING_SM,
} from '@/components/ayuda/pieces/app-look';

type ServicesListPieceProps = { lines: Array<{ name: string; amount: number }> };

/** Composer Servicios section: count, + Agregar servicio (ringed), lines and Total. */
export const ServicesListPiece = ({ lines }: ServicesListPieceProps) => {
  const total = lines.reduce((sum, line) => sum + line.amount, 0);
  return (
    <div aria-hidden className={`${APP_PIECE_CARD} flex flex-col gap-2.5 p-3.5`}>
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <strong className="font-semibold">
          Servicios <span className={`font-normal ${APP_MUTED}`}>· {lines.length}</span>
        </strong>
        <span
          className={`inline-flex h-9 items-center rounded-[10px] border border-[#CBD5E1] px-3 font-medium ${TOUCH_RING_SM}`}
        >
          + Agregar servicio
        </span>
      </div>
      {lines.map((line) => (
        <div key={line.name} className="flex justify-between gap-3">
          <span className="min-w-0">{line.name}</span>
          <span className="whitespace-nowrap tabular-nums">{formatPieceMoney(line.amount)}</span>
        </div>
      ))}
      <div className="flex items-baseline justify-between gap-3 border-t border-[#E2E8F0] pt-2.5">
        <span className={`text-sm font-semibold tracking-[0.08em] ${APP_MUTED}`}>TOTAL</span>
        <strong className="text-xl font-bold tabular-nums">{formatPieceMoney(total)}</strong>
      </div>
    </div>
  );
};
