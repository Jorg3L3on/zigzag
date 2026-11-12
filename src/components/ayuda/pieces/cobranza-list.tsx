import {
  APP_MUTED,
  APP_PIECE_CARD,
  formatPieceMoney,
  TOUCH_RING_SM,
} from '@/components/ayuda/pieces/app-look';

export type PieceCobranzaRing = 'sort' | 'cobrar' | 'whatsapp';

type CobranzaListPieceProps = {
  count: number;
  totalDue: number;
  card: {
    clientName: string;
    folio: string;
    services: string;
    dateLabel: string;
    days: number;
    total: number;
    paid: number;
  };
  ring: PieceCobranzaRing;
};

/** Phone Cobranza (CobranzaList): the summary, Ordenar and one ticket card. */
export const CobranzaListPiece = ({ count, totalDue, card, ring }: CobranzaListPieceProps) => (
  <div aria-hidden className="flex w-full max-w-[340px] min-w-0 flex-col gap-2.5">
    <div className={`${APP_PIECE_CARD} flex flex-wrap justify-between gap-x-3 gap-y-1 px-3.5 py-2.5`}>
      <span className={APP_MUTED}>
        <strong className="font-semibold text-[#0B1220]">{count}</strong> tickets con saldo
      </span>
      <strong className="font-semibold tabular-nums text-[#92400E]">
        Total por cobrar: {formatPieceMoney(totalDue)}
      </strong>
    </div>
    <div className="flex items-center gap-2.5">
      <span className="font-medium">Ordenar</span>
      <span
        className={`flex h-11 min-w-0 flex-1 items-center rounded-xl border border-[#CBD5E1] bg-white px-3 ${
          ring === 'sort' ? TOUCH_RING_SM : ''
        }`}
      >
        Días sin pagar
      </span>
    </div>
    <div className={`${APP_PIECE_CARD} flex flex-col gap-2 p-3.5`}>
      <span className="min-w-0">
        <strong className="block font-semibold [overflow-wrap:anywhere]">{card.clientName}</strong>
        <span className={`block ${APP_MUTED}`}>Ticket {card.folio}</span>
      </span>
      <span className="[overflow-wrap:anywhere]">{card.services}</span>
      <span className="flex flex-wrap justify-between gap-x-3">
        <span>{card.dateLabel}</span>
        <span className={APP_MUTED}>{card.days} días sin pagar</span>
      </span>
      <strong className="font-semibold tabular-nums text-[#92400E]">
        Saldo {formatPieceMoney(card.total - card.paid)}
      </strong>
      <span
        className={`flex min-h-11 items-center justify-center rounded-xl bg-[#2563EB] font-semibold text-white ${
          ring === 'cobrar' ? TOUCH_RING_SM : ''
        }`}
      >
        Cobrar
      </span>
      <span
        className={`flex min-h-11 items-center justify-center rounded-xl border border-[#CBD5E1] px-2 text-center ${
          ring === 'whatsapp' ? TOUCH_RING_SM : ''
        }`}
      >
        Recordar por WhatsApp
      </span>
    </div>
  </div>
);
