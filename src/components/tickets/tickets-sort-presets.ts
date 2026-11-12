import type { SortingState } from '@tanstack/react-table';
import type { TicketListSort, TicketListSortColumn } from '@/actions/tickets';

/** Orden inicial al cargar (fecha del ticket, más recientes primero). */
export const DEFAULT_TICKET_SORTING: SortingState = [
  { id: 'ticket_date', desc: true },
];

const SORT_OPTION_ROWS: { value: string; label: string }[] = [
  { value: 'ticket_date:desc', label: 'Fecha del ticket (recientes primero)' },
  { value: 'ticket_date:asc', label: 'Fecha del ticket (antiguos primero)' },
  { value: 'id:desc', label: 'ID (mayor a menor)' },
  { value: 'id:asc', label: 'ID (menor a mayor)' },
  { value: 'client_name:asc', label: 'Cliente (A → Z)' },
  { value: 'client_name:desc', label: 'Cliente (Z → A)' },
  { value: 'client_tel:asc', label: 'Teléfono (menor a mayor)' },
  { value: 'client_tel:desc', label: 'Teléfono (mayor a menor)' },
  { value: 'paymentRank:asc', label: 'Pagados primero' },
  { value: 'paymentRank:desc', label: 'Pendientes primero' },
  { value: 'total:desc', label: 'Total (mayor a menor)' },
  { value: 'total:asc', label: 'Total (menor a mayor)' },
  { value: 'balance:desc', label: 'Saldo (mayor a menor)' },
];

/** Every order, for the phone filter sheet. Desktop sorts by the column headers (ZIG-I33-2). */
export const TICKETS_MOBILE_SORT_OPTIONS: { value: string; label: string }[] = SORT_OPTION_ROWS;

/**
 * The only sorts a phone shows beside the chips (ZIG-I18-9). The full list above
 * stays in the filter sheet.
 */
export const TICKETS_PHONE_SORT_OPTIONS: { value: string; label: string }[] = [
  { value: 'ticket_date:desc', label: 'Más recientes' },
  { value: 'ticket_date:asc', label: 'Más antiguos' },
  { value: 'balance:desc', label: 'Mayor saldo' },
];

export const encodeSortingState = (sorting: SortingState): string => {
  if (!sorting.length) {
    return `${DEFAULT_TICKET_SORTING[0].id}:${DEFAULT_TICKET_SORTING[0].desc ? 'desc' : 'asc'}`;
  }
  const s = sorting[0];
  return `${s.id}:${s.desc ? 'desc' : 'asc'}`;
};

export const decodeSortingState = (value: string): SortingState => {
  const idx = value.lastIndexOf(':');
  if (idx <= 0) {
    return DEFAULT_TICKET_SORTING;
  }
  const id = value.slice(0, idx);
  const dir = value.slice(idx + 1);
  return [{ id, desc: dir === 'desc' }];
};

/** Table column id → the server's sort column; the same names go to `?orden=` (ZIG-I33-2). */
const SERVER_SORT_COLUMN: Record<string, TicketListSortColumn> = {
  id: 'folio',
  client_name: 'cliente',
  client_tel: 'telefono',
  ticket_date: 'fecha',
  total: 'total',
  balance: 'saldo',
  paymentRank: 'estado',
};

const COLUMN_ID_BY_SERVER_SORT = Object.fromEntries(
  Object.entries(SERVER_SORT_COLUMN).map(([id, column]) => [column, id]),
) as Record<TicketListSortColumn, string>;

const hasKey = (record: object, key: string) => Object.prototype.hasOwnProperty.call(record, key);

/** What the server sorts by for the table's sorting; the default when it names no known column. */
export const ticketListSortForServer = (sorting: SortingState): TicketListSort => {
  const first = sorting[0] ?? DEFAULT_TICKET_SORTING[0];
  const column = hasKey(SERVER_SORT_COLUMN, first.id)
    ? SERVER_SORT_COLUMN[first.id]
    : SERVER_SORT_COLUMN[DEFAULT_TICKET_SORTING[0].id];
  const desc = hasKey(SERVER_SORT_COLUMN, first.id) ? first.desc : DEFAULT_TICKET_SORTING[0].desc;
  return { column, direction: desc ? 'desc' : 'asc' };
};

/** `fecha-desc`: the column, a dash, the direction; the old select wrote `ticket_date:desc`. */
const splitSortParam = (value: string): [string, string] | null => {
  const idx = Math.max(value.lastIndexOf('-'), value.lastIndexOf(':'));
  return idx > 0 ? [value.slice(0, idx), value.slice(idx + 1)] : null;
};

/**
 * `?orden=` → sorting. Reads `total-desc` (written since ZIG-I33-2) and the old select
 * values (`ticket_date:desc`, `paymentRank:asc`), so older links keep working;
 * anything else is the default, newest ticket date first.
 */
export const parseTicketSortParam = (value: string | null | undefined): SortingState => {
  const parts = value ? splitSortParam(value) : null;
  if (!parts) return DEFAULT_TICKET_SORTING;
  const [key, dir] = parts;
  if (dir !== 'asc' && dir !== 'desc') return DEFAULT_TICKET_SORTING;
  const id = hasKey(COLUMN_ID_BY_SERVER_SORT, key)
    ? COLUMN_ID_BY_SERVER_SORT[key as TicketListSortColumn]
    : hasKey(SERVER_SORT_COLUMN, key)
      ? key
      : null;
  return id ? [{ id, desc: dir === 'desc' }] : DEFAULT_TICKET_SORTING;
};

/** sorting → `?orden=` (`total-desc`); null for the default, which stays out of the URL. */
export const ticketSortParam = (sorting: SortingState): string | null => {
  const { column, direction } = ticketListSortForServer(sorting);
  const fallback = ticketListSortForServer(DEFAULT_TICKET_SORTING);
  if (column === fallback.column && direction === fallback.direction) return null;
  return `${column}-${direction}`;
};
