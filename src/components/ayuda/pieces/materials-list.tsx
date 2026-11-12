import {
  APP_MUTED,
  APP_PIECE_CARD,
  formatPieceMoney,
  TOUCH_RING,
  TOUCH_RING_SM,
} from '@/components/ayuda/pieces/app-look';

export type PieceMaterial = { name: string; quantity: number; unit?: string; price: number };

type MaterialsListPieceProps = {
  service: { name: string; amount: number };
  materials: PieceMaterial[];
  /** add: + Agregar in Materiales; submit: Agregar al ticket. */
  ring: 'add' | 'submit';
};

/** The Agregar servicio sheet (ComposerLineSheet): Materiales · N, its rows and Suma. */
export const MaterialsListPiece = ({ service, materials, ring }: MaterialsListPieceProps) => {
  const materialsTotal = materials.reduce((sum, item) => sum + item.quantity * item.price, 0);
  return (
    <div aria-hidden className={`${APP_PIECE_CARD} flex min-w-0 flex-col gap-2.5 p-3.5`}>
      <span className="flex justify-between gap-3">
        <strong className="min-w-0 font-semibold [overflow-wrap:anywhere]">{service.name}</strong>
        <span className="shrink-0 tabular-nums">{formatPieceMoney(service.amount)}</span>
      </span>
      <span className="flex items-center justify-between gap-3 border-t border-[#E2E8F0] pt-2.5">
        <strong className="font-semibold">
          Materiales <span className={`font-normal ${APP_MUTED}`}>· {materials.length}</span>
        </strong>
        <span
          className={`inline-flex h-9 items-center rounded-[10px] px-2.5 font-semibold text-[#2563EB] ${
            ring === 'add' ? TOUCH_RING_SM : ''
          }`}
        >
          + Agregar
        </span>
      </span>
      {materials.length === 0 ? (
        <span className={APP_MUTED}>Sin materiales. Se suman al precio del servicio.</span>
      ) : (
        materials.map((item) => (
          <span key={item.name} className="flex items-center justify-between gap-3">
            <span className="min-w-0">
              <span className="block font-medium [overflow-wrap:anywhere]">{item.name}</span>
              <span className={`block tabular-nums ${APP_MUTED}`}>
                {item.quantity}
                {item.unit ? ` ${item.unit}` : ''} × {formatPieceMoney(item.price)}
              </span>
            </span>
            <span className="shrink-0 font-semibold tabular-nums">
              {formatPieceMoney(item.quantity * item.price)}
            </span>
          </span>
        ))
      )}
      <span className="flex items-end justify-between gap-3 border-t border-[#E2E8F0] pt-2.5">
        <span className={`min-w-0 tabular-nums ${APP_MUTED}`}>
          <span className="block">Servicio {formatPieceMoney(service.amount)}</span>
          <span className="block">Materiales {formatPieceMoney(materialsTotal)}</span>
        </span>
        <span className="text-right">
          <span className={`block ${APP_MUTED}`}>Suma</span>
          <strong className="block text-lg font-bold tabular-nums">
            {formatPieceMoney(service.amount + materialsTotal)}
          </strong>
        </span>
      </span>
      <span className="grid grid-cols-2 gap-2">
        <span className="flex min-h-11 items-center justify-center rounded-xl border border-[#CBD5E1]">Cancelar</span>
        <span
          className={`flex min-h-11 items-center justify-center rounded-xl bg-[#2563EB] px-1 text-center font-semibold text-white ${
            ring === 'submit' ? TOUCH_RING : ''
          }`}
        >
          Agregar al ticket
        </span>
      </span>
    </div>
  );
};
