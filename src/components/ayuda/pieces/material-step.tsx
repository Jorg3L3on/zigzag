import {
  APP_MUTED,
  APP_PIECE_CARD,
  formatPieceMoney,
  TOUCH_RING,
} from '@/components/ayuda/pieces/app-look';
import type { PieceMaterial } from '@/components/ayuda/pieces/materials-list';

type MaterialStepPieceProps = { mode: 'catalog' | 'custom'; material: PieceMaterial };

/** Agregar material step (MaterialEntryFields): Mis materiales / Escribir, Cantidad, Precio. */
export const MaterialStepPiece = ({ mode, material }: MaterialStepPieceProps) => (
  <div aria-hidden className={`${APP_PIECE_CARD} flex min-w-0 flex-col gap-3 p-3.5`}>
    <strong className="text-base font-semibold">Agregar material</strong>
    <span className="grid grid-cols-2 gap-1 rounded-xl bg-[#F1F5F9] p-1">
      {(['catalog', 'custom'] as const).map((option) => (
        <span
          key={option}
          className={`flex h-9 items-center justify-center rounded-lg ${
            option === mode ? 'bg-white font-semibold shadow-sm' : APP_MUTED
          }`}
        >
          {option === 'catalog' ? 'Mis materiales' : 'Escribir'}
        </span>
      ))}
    </span>
    <span>
      <span className="mb-1 block font-medium">{mode === 'catalog' ? 'Material' : 'Nombre del material'}</span>
      <span className="flex min-h-11 items-center rounded-xl border border-[#CBD5E1] px-3 [overflow-wrap:anywhere]">
        {material.name}
      </span>
    </span>
    <span className="grid grid-cols-2 gap-2">
      <span className="min-w-0">
        <span className="mb-1 block font-medium">Cantidad</span>
        <span className="flex h-11 items-center rounded-xl border border-[#CBD5E1] px-3 tabular-nums">
          {material.quantity}
        </span>
      </span>
      <span className="min-w-0">
        <span className="mb-1 block font-medium">Precio{material.unit ? ` / ${material.unit}` : ''}</span>
        <span className="flex h-11 items-center rounded-xl border border-[#CBD5E1] px-3 tabular-nums">
          {formatPieceMoney(material.price)}
        </span>
      </span>
    </span>
    <span className="grid grid-cols-2 gap-2">
      <span className="flex min-h-11 items-center justify-center rounded-xl border border-[#CBD5E1]">Volver</span>
      <span
        className={`flex min-h-11 items-center justify-center rounded-xl bg-[#2563EB] px-1 text-center font-semibold text-white ${TOUCH_RING}`}
      >
        Agregar material
      </span>
    </span>
  </div>
);
