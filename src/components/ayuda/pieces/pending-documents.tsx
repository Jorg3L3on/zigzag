import { AppButton } from '@/components/ayuda/pieces/app-field';
import { APP_MUTED, APP_PIECE_CARD, formatPieceMoney } from '@/components/ayuda/pieces/app-look';

type PendingDocumentsPieceProps = { client: string; notes: string; total: number };

/** "Tickets sin sincronizar" above the Tickets list (PendingDocumentsStrip), Abrir ringed. */
export const PendingDocumentsPiece = ({ client, notes, total }: PendingDocumentsPieceProps) => (
  <div aria-hidden className={`${APP_PIECE_CARD} flex flex-col gap-2.5 p-3.5`}>
    <strong className="font-semibold">Tickets sin sincronizar</strong>
    <span className="flex items-start justify-between gap-3">
      <span className="flex min-w-0 flex-col">
        <span className="font-semibold">{client}</span>
        <span className={APP_MUTED}>{notes}</span>
      </span>
      <span className="font-semibold tabular-nums">{formatPieceMoney(total)}</span>
    </span>
    <span className="flex flex-wrap items-center gap-2">
      <span className="rounded-full bg-[#DBEAFE] px-2.5 py-0.5 font-medium text-[#1D4ED8]">
        Pendiente de sincronizar
      </span>
      <span className={APP_MUTED}>Sin folio todavía · no es factura</span>
    </span>
    <AppButton ringed className="self-start">
      Abrir
    </AppButton>
  </div>
);
