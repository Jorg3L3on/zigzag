'use client';

import type { Table as ReactTable } from '@tanstack/react-table';
import { ListTable } from '@/components/list-page';
import type { CobranzaRow } from '@/lib/cobranza';

/** Clientes and Servicios still import these from here until ZIG-I33-4 points them at ListTable. */
export {
  COBRANZA_TABLE_CARD_CLASS,
  COBRANZA_TABLE_CLASS,
} from '@/components/list-page/legacy-aliases';

/**
 * Por ticket (ZIG-I31-2, ZIG-I33-3): the shared list table at the dense padding, so
 * Cliente keeps room at 1280 with the sidebar open (CobA). The row opens the ticket
 * by click, Enter or Space.
 */
export const CobranzaTicketTable = ({
  table,
  busy = false,
}: {
  table: ReactTable<CobranzaRow>;
  busy?: boolean;
}) => (
  <ListTable
    table={table}
    dense
    busy={busy}
    ariaLabel="Tickets por cobrar"
    getRowHref={(row) => `/tickets/${row.original.id}`}
    rowTestId="cobranza-row"
  />
);
