import {
  LIST_TABLE_CARD_CLASS,
  LIST_TABLE_CLASS,
  LIST_TABLE_DENSE_PADDING_CLASS,
} from '@/components/ui/table';

/*
 * Aliases for pages that still style a hand-made table with the old Cobranza recipe
 * (Clientes, the client history, Servicios). Cobranza itself moved to `ListTable dense`
 * in ZIG-I33-3; ZIG-I33-4 points the rest at `ListTable` and the phase-9 cleanup deletes
 * this file. Do not use them in new code.
 */

/** The old Cobranza table: the list recipe at the dense padding (6 px per side). */
export const COBRANZA_TABLE_CLASS = `${LIST_TABLE_CLASS} ${LIST_TABLE_DENSE_PADDING_CLASS}`;

/** The old Cobranza card, now `ListTableCard`. */
export const COBRANZA_TABLE_CARD_CLASS = LIST_TABLE_CARD_CLASS;
