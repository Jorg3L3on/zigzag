import {
  APP_MUTED,
  APP_PIECE_CARD,
  formatPieceMoney,
  TOUCH_RING_SM,
} from '@/components/ayuda/pieces/app-look';

export type PieceTicketState = 'working' | 'partial' | 'paid';
export type PieceTicketTile = 'Cobrar' | 'WhatsApp' | 'PDF';

type TicketActionsPieceProps = {
  folio: string;
  clientName: string;
  state: PieceTicketState;
  total: number;
  paid: number;
  ring?: PieceTicketTile;
};

/** TicketDetailStatusPill labels. */
const PILL: Record<PieceTicketState, { label: string; className: string }> = {
  working: { label: 'En proceso', className: 'bg-[#E2E8F0] text-[#334155]' },
  partial: { label: 'Pago parcial', className: 'bg-[#FEF3C7] text-[#92400E]' },
  paid: { label: 'Pagado', className: 'bg-[#D1FAE5] text-[#065F46]' },
};

/**
 * Ticket detail on the phone: folio and pill, the hero (Total / Saldo por
 * cobrar / Pagado) and the Cobrar · WhatsApp · PDF tiles, one ringed.
 */
export const TicketActionsPiece = ({ folio, clientName, state, total, paid, ring }: TicketActionsPieceProps) => {
  const pill = PILL[state];
  const tiles: PieceTicketTile[] =
    state === 'working' ? [] : state === 'partial' ? ['Cobrar', 'WhatsApp', 'PDF'] : ['WhatsApp', 'PDF'];
  const heroLabel = state === 'working' ? 'Total' : state === 'paid' ? 'Pagado' : 'Saldo por cobrar';
  const heroAmount = state === 'partial' ? total - paid : total;
  return (
    <div aria-hidden className={`${APP_PIECE_CARD} flex min-w-0 flex-col gap-3 p-3.5`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="min-w-0">
          <strong className="block font-semibold">{folio}</strong>
          <span className={`block [overflow-wrap:anywhere] ${APP_MUTED}`}>{clientName}</span>
        </span>
        <span className={`shrink-0 rounded-full px-2.5 py-1 font-semibold ${pill.className}`}>{pill.label}</span>
      </div>
      <div className="rounded-xl bg-[#F8FAFC] px-3 py-2.5">
        <span className={`block ${APP_MUTED}`}>{heroLabel}</span>
        <strong className="block text-2xl font-bold tabular-nums">{formatPieceMoney(heroAmount)}</strong>
        <span className={`block ${APP_MUTED}`}>
          {state === 'working'
            ? 'El cobro se registra al finalizar el ticket.'
            : state === 'partial'
              ? `Pagado ${formatPieceMoney(paid)} de ${formatPieceMoney(total)}`
              : null}
        </span>
      </div>
      {tiles.length > 0 ? (
        <div className={`grid gap-2 ${tiles.length === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
          {tiles.map((tile) => (
            <span
              key={tile}
              className={`flex h-[60px] min-w-0 items-center justify-center rounded-xl border border-[#E2E8F0] font-medium ${
                tile === ring ? TOUCH_RING_SM : ''
              }`}
            >
              {tile}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
};
