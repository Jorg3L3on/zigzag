import {
  APP_MUTED,
  APP_PIECE_CARD,
  formatPieceMoney,
  TOUCH_RING,
  TOUCH_RING_SM,
} from '@/components/ayuda/pieces/app-look';

type PresupuestoCardPieceProps = {
  /** row: the Presupuestos list; detail: the phone detail; confirm: the Convertir question. */
  view: 'row' | 'detail' | 'confirm';
  folio: string;
  clientName: string;
  total: number;
  expiresLabel: string;
  /** Detail only: which control is ringed. */
  ring?: 'convert' | 'share';
};

const Primary = ({ label, ringed }: { label: string; ringed: boolean }) => (
  <span
    className={`flex min-h-12 min-w-0 flex-1 items-center justify-center rounded-xl bg-[#2563EB] px-2 text-center font-semibold text-white ${
      ringed ? TOUCH_RING : ''
    }`}
  >
    {label}
  </span>
);

/** Presupuesto screens on the phone (PresupuestosList, PresupuestoDetailLayout, PresupuestoConfirmSheet). */
export const PresupuestoCardPiece = ({ view, folio, clientName, total, expiresLabel, ring }: PresupuestoCardPieceProps) => {
  if (view === 'row') {
    return (
      <div aria-hidden className={`${APP_PIECE_CARD} flex min-w-0 flex-col gap-1 px-3.5 py-3 ${TOUCH_RING_SM}`}>
        <span className="flex justify-between gap-3">
          <strong className="min-w-0 font-medium [overflow-wrap:anywhere]">{clientName}</strong>
          <strong className="shrink-0 tabular-nums">{formatPieceMoney(total)}</strong>
        </span>
        <span className={`flex flex-wrap justify-between gap-x-3 ${APP_MUTED}`}>
          <span>{folio}</span>
          <span className="rounded-full bg-[#E2E8F0] px-2 font-semibold text-[#334155]">Abierto</span>
        </span>
      </div>
    );
  }
  if (view === 'confirm') {
    return (
      <div aria-hidden className={`${APP_PIECE_CARD} flex min-w-0 flex-col gap-3 p-3.5`}>
        <strong className="text-base font-semibold">¿Convertir el presupuesto {folio} en ticket?</strong>
        <span className={APP_MUTED}>
          Se crea un ticket de trabajo con los mismos servicios y precios. El presupuesto queda como Aceptado.
        </span>
        <span className="flex flex-wrap gap-2">
          <span className="flex min-h-12 min-w-0 flex-1 items-center justify-center rounded-xl border border-[#CBD5E1]">
            Volver
          </span>
          <Primary label="Convertir a ticket" ringed />
        </span>
      </div>
    );
  }
  return (
    <div aria-hidden className={`${APP_PIECE_CARD} flex min-w-0 flex-col gap-3 p-3.5`}>
      <span className="flex items-center justify-between gap-2">
        <strong className="font-semibold">{folio}</strong>
        <span
          className={`inline-flex h-10 items-center rounded-xl border border-[#CBD5E1] px-2.5 font-semibold ${
            ring === 'share' ? TOUCH_RING_SM : ''
          }`}
        >
          Compartir
        </span>
      </span>
      <span>
        <span className={`block ${APP_MUTED}`}>Total del presupuesto</span>
        <strong className="block text-2xl font-bold tabular-nums">{formatPieceMoney(total)}</strong>
        <span className={`block ${APP_MUTED}`}>{expiresLabel}</span>
      </span>
      <div className="flex flex-col gap-2 rounded-xl border border-[#BFDBFE] bg-[#EFF6FF] p-3">
        <strong className="font-semibold">¿Lo aceptó el cliente?</strong>
        <span className={APP_MUTED}>Conviértelo en ticket para trabajarlo y cobrar el anticipo.</span>
        <span className="flex">
          <Primary label="Convertir a ticket" ringed={ring === 'convert'} />
        </span>
      </div>
    </div>
  );
};
