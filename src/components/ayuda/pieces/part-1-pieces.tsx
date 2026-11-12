import { CobranzaListPiece } from '@/components/ayuda/pieces/cobranza-list';
import { ExpiresAtFieldPiece } from '@/components/ayuda/pieces/expires-at-field';
import { FinishTicketCardPiece } from '@/components/ayuda/pieces/finish-ticket-card';
import { MaterialStepPiece } from '@/components/ayuda/pieces/material-step';
import { MaterialsListPiece } from '@/components/ayuda/pieces/materials-list';
import { DockTabPiece } from '@/components/ayuda/pieces/mobile-dock';
import { PaymentSheetPiece } from '@/components/ayuda/pieces/payment-sheet';
import { PresupuestoCardPiece } from '@/components/ayuda/pieces/presupuesto-card';
import { ShareReceiptPiece } from '@/components/ayuda/pieces/share-receipt';
import { TicketActionsPiece } from '@/components/ayuda/pieces/ticket-actions';
import type { ComponentProps, JSXElementConstructor } from 'react';

type Spec<K extends string, C extends JSXElementConstructor<any>> = { kind: K } & ComponentProps<C>;

/**
 * Pieces of the ZIG-I40-3 guides (tickets, cobro, presupuestos). The Crear
 * menu is the shared `create-menu` kind of part-2-pieces.ts.
 */
export type Part1PieceSpec =
  | Spec<'dock-tab', typeof DockTabPiece>
  | Spec<'ticket-actions', typeof TicketActionsPiece>
  | Spec<'finish-ticket-card', typeof FinishTicketCardPiece>
  | Spec<'payment-sheet', typeof PaymentSheetPiece>
  | Spec<'cobranza-list', typeof CobranzaListPiece>
  | Spec<'share-receipt', typeof ShareReceiptPiece>
  | Spec<'presupuesto-card', typeof PresupuestoCardPiece>
  | Spec<'expires-at-field', typeof ExpiresAtFieldPiece>
  | Spec<'materials-list', typeof MaterialsListPiece>
  | Spec<'material-step', typeof MaterialStepPiece>;

export const Part1Piece = ({ piece }: { piece: Part1PieceSpec }) => {
  switch (piece.kind) {
    case 'dock-tab':
      return <DockTabPiece {...piece} />;
    case 'ticket-actions':
      return <TicketActionsPiece {...piece} />;
    case 'finish-ticket-card':
      return <FinishTicketCardPiece {...piece} />;
    case 'payment-sheet':
      return <PaymentSheetPiece {...piece} />;
    case 'cobranza-list':
      return <CobranzaListPiece {...piece} />;
    case 'share-receipt':
      return <ShareReceiptPiece {...piece} />;
    case 'presupuesto-card':
      return <PresupuestoCardPiece {...piece} />;
    case 'expires-at-field':
      return <ExpiresAtFieldPiece {...piece} />;
    case 'materials-list':
      return <MaterialsListPiece {...piece} />;
    case 'material-step':
      return <MaterialStepPiece {...piece} />;
  }
};
