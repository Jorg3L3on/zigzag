import {
  APP_MUTED,
  APP_PIECE_CARD,
  formatPieceMoney,
  TOUCH_RING,
} from '@/components/ayuda/pieces/app-look';
import { buildWhatsAppReceiptMessage } from '@/lib/whatsapp-share';

type ShareReceiptPieceProps = {
  /**
   * prompt: «¿Le envías el recibo a tu cliente?» after Guardar y terminar;
   * message: the text the WhatsApp tile opens; share-bar: Compartir recibo.
   */
  view: 'prompt' | 'message' | 'share-bar';
  folio: string;
  clientName: string;
  companyName: string;
  total: number;
  paid: number;
};

/** Sending the recibo: the app's prompt, its WhatsApp text, or the Compartir recibo bar. */
export const ShareReceiptPiece = ({ view, folio, clientName, companyName, total, paid }: ShareReceiptPieceProps) => {
  if (view === 'message') {
    // The same text the app builds (lib/whatsapp-share.ts), so it never drifts.
    const text = buildWhatsAppReceiptMessage({ clientName, ticketId: 0, folio, total, paid, companyName });
    return (
      <div aria-hidden className="flex w-full max-w-[340px] min-w-0 flex-col rounded-2xl bg-[#E7DED3] p-3">
        <p className="m-0 ml-auto max-w-[92%] rounded-xl rounded-tr-sm bg-[#D9FDD3] px-3 py-2 text-sm text-[#111B21] [overflow-wrap:anywhere]">
          {text}
        </p>
      </div>
    );
  }
  if (view === 'share-bar') {
    return (
      <div aria-hidden className={`${APP_PIECE_CARD} flex min-w-0 flex-col gap-2.5 p-3`}>
        <span className="flex justify-between gap-3">
          <span className={APP_MUTED}>Pagado</span>
          <strong className="tabular-nums">{formatPieceMoney(total)}</strong>
        </span>
        <span
          className={`flex min-h-12 items-center justify-center rounded-xl bg-[#2563EB] font-semibold text-white ${TOUCH_RING}`}
        >
          Compartir recibo
        </span>
      </div>
    );
  }
  return (
    <div aria-hidden className={`${APP_PIECE_CARD} flex min-w-0 flex-col gap-3 p-3.5`}>
      <span>
        <strong className="block text-base font-semibold">Ticket {folio} terminado</strong>
        <span className={`block ${APP_MUTED}`}>¿Le envías el recibo a tu cliente?</span>
      </span>
      <dl className="m-0 flex flex-col gap-1">
        {[
          ['Total', total],
          ['Pagado', paid],
          ...(total > paid ? [['Saldo por cobrar', total - paid] as const] : []),
        ].map(([label, value]) => (
          <span key={label} className="flex justify-between gap-3">
            <dt className={APP_MUTED}>{label}</dt>
            <dd className="m-0 font-medium tabular-nums">{formatPieceMoney(value as number)}</dd>
          </span>
        ))}
      </dl>
      <span className="flex flex-wrap gap-2">
        <span className="flex min-h-11 min-w-0 flex-1 items-center justify-center rounded-xl border border-[#CBD5E1] px-2">
          Ahora no
        </span>
        <span
          className={`flex min-h-11 min-w-0 flex-1 items-center justify-center rounded-xl bg-[#2563EB] px-2 font-semibold text-white ${TOUCH_RING}`}
        >
          Enviar recibo
        </span>
      </span>
    </div>
  );
};
