import {
  APP_MUTED,
  APP_PIECE_CARD,
  formatPieceMoney,
  TOUCH_RING,
} from '@/components/ayuda/pieces/app-look';

type PaymentSheetPieceProps = {
  total: number;
  paid: number;
  /** start: Pagó todo / Pagó una parte; partial: ¿Cuánto pagó? and Anotar este pago. */
  view: 'start' | 'partial';
  /** Amount typed in the partial view. */
  amount?: number;
};

/** Phone Cobrar sheet (TicketListCollectPaymentDialog), the control to touch ringed. */
export const PaymentSheetPiece = ({ total, paid, view, amount = 0 }: PaymentSheetPieceProps) => {
  const due = total - paid;
  return (
    <div aria-hidden className={`${APP_PIECE_CARD} flex min-w-0 flex-col gap-3 p-3.5`}>
      <span>
        <strong className="block text-base font-semibold">Cobrar</strong>
        <span className={`block ${APP_MUTED}`}>Elige cuánto te pagó el cliente.</span>
      </span>
      <div className="grid grid-cols-3 gap-2 rounded-lg bg-[#F1F5F9] p-2.5">
        {[
          ['Total', total],
          ['Pagado', paid],
          ['Por pagar', due],
        ].map(([label, value]) => (
          <span key={label} className="min-w-0">
            <span className={`block ${APP_MUTED}`}>{label}</span>
            <span className="block font-medium tabular-nums [overflow-wrap:anywhere]">
              {formatPieceMoney(value as number)}
            </span>
          </span>
        ))}
      </div>
      <span
        className={`flex min-h-12 items-center justify-center rounded-xl bg-[#2563EB] px-3 text-center font-semibold text-white ${
          view === 'start' ? TOUCH_RING : ''
        }`}
      >
        Pagó todo · {formatPieceMoney(due)}
      </span>
      {view === 'start' ? (
        <span className="flex min-h-11 items-center justify-center rounded-xl border border-[#CBD5E1] font-medium">
          Pagó una parte
        </span>
      ) : (
        <div className="flex flex-col gap-2.5 rounded-xl border border-[#E2E8F0] p-3">
          <span className="font-medium">¿Cuánto pagó?</span>
          <span className="flex h-11 items-center rounded-lg border border-[#CBD5E1] px-3 tabular-nums">
            $ {amount.toLocaleString('en-US')}
          </span>
          <span className="flex flex-wrap gap-1.5">
            {['La mitad', '$500', '$1,000'].map((chip) => (
              <span key={chip} className="rounded-full border border-[#CBD5E1] px-3 py-1.5">
                {chip}
              </span>
            ))}
          </span>
          <span
            className={`flex min-h-11 items-center justify-center rounded-xl bg-[#F1F5F9] font-semibold ${TOUCH_RING}`}
          >
            Anotar este pago
          </span>
        </div>
      )}
    </div>
  );
};
