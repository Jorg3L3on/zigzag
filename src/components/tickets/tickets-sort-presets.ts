import type { SortingState } from '@tanstack/react-table';

/** Orden inicial al cargar (fecha del ticket, más recientes primero). */
export const DEFAULT_TICKET_SORTING: SortingState = [
  { id: 'ticket_date', desc: true },
];

const SORT_OPTION_ROWS: { value: string; label: string }[] = [
  {
    value: 'ticket_date:desc',
    label: 'Fecha del ticket (recientes primero)',
  },
  {
    value: 'ticket_date:asc',
    label: 'Fecha del ticket (antiguos primero)',
  },
  { value: 'id:desc', label: 'ID (mayor a menor)' },
  { value: 'id:asc', label: 'ID (menor a mayor)' },
  {
    value: 'client_name:asc',
    label: 'Cliente (A → Z)',
  },
  {
    value: 'client_name:desc',
    label: 'Cliente (Z → A)',
  },
  {
    value: 'client_tel:asc',
    label: 'Teléfono (menor a mayor)',
  },
  {
    value: 'client_tel:desc',
    label: 'Teléfono (mayor a menor)',
  },
  {
    value: 'paymentRank:asc',
    label: 'Pagados primero',
  },
  {
    value: 'paymentRank:desc',
    label: 'Pendientes primero',
  },
  { value: 'total:desc', label: 'Total (mayor a menor)' },
  { value: 'total:asc', label: 'Total (menor a mayor)' },
  { value: 'balance:desc', label: 'Saldo (mayor a menor)' },
];

export const TICKETS_MOBILE_SORT_OPTIONS = SORT_OPTION_ROWS;

/**
 * The only sorts a phone shows beside the chips (ZIG-I18-9). The full list above
 * stays in the filter sheet and on desktop.
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
