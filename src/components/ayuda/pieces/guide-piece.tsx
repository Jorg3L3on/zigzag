import type { GuidePiece as GuidePieceSpec } from '@/components/ayuda/guide-registry';
import { BottomDockPiece } from '@/components/ayuda/pieces/bottom-dock';
import { ClientCardPiece } from '@/components/ayuda/pieces/client-card';
import { Part1Piece } from '@/components/ayuda/pieces/part-1-pieces';
import { PaymentChoicePiece } from '@/components/ayuda/pieces/payment-choice';
import { SaveBarPiece } from '@/components/ayuda/pieces/save-bar';
import { ServicesListPiece } from '@/components/ayuda/pieces/services-list';

/** Draws the piece a guide step names in the registry. Add new kinds here. */
export const GuidePiece = ({ piece }: { piece: GuidePieceSpec }) => {
  switch (piece.kind) {
    case 'bottom-dock':
      return <BottomDockPiece />;
    case 'client-card':
      return <ClientCardPiece name={piece.name} phone={piece.phone} dateLabel={piece.dateLabel} />;
    case 'services-list':
      return <ServicesListPiece lines={piece.lines} />;
    case 'payment-choice':
      return <PaymentChoicePiece initial={piece.initial} explanations={piece.explanations} />;
    case 'save-bar':
      return <SaveBarPiece countLabel={piece.countLabel} total={piece.total} label={piece.label} />;
    case 'dock-tab': case 'create-menu': case 'ticket-actions': case 'finish-ticket-card':
    case 'payment-sheet': case 'cobranza-list': case 'share-receipt': case 'presupuesto-card':
    case 'expires-at-field': case 'materials-list': case 'material-step':
      return <Part1Piece piece={piece} />;
  }
};
