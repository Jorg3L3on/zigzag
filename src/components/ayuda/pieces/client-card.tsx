import { APP_MUTED, APP_PIECE_CARD } from '@/components/ayuda/pieces/app-look';

type ClientCardPieceProps = { name: string; phone: string; dateLabel: string };

/** Composer client card once a client is chosen: initial, name, phone · date and Cambiar. */
export const ClientCardPiece = ({ name, phone, dateLabel }: ClientCardPieceProps) => (
  <div aria-hidden className={`${APP_PIECE_CARD} flex items-center gap-2.5 px-3.5 py-3`}>
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#DBEAFE] font-semibold text-[#1D4ED8]">
      {name.trim().charAt(0).toUpperCase()}
    </span>
    <span className="flex min-w-0 flex-1 flex-col">
      <strong className="font-semibold [overflow-wrap:anywhere]">{name}</strong>
      <span className={APP_MUTED}>
        {phone} · {dateLabel}
      </span>
    </span>
    <span className="inline-flex h-9 shrink-0 items-center rounded-[10px] border border-[#CBD5E1] px-3 font-medium">
      Cambiar
    </span>
  </div>
);
