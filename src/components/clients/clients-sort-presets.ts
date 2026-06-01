import type { SortingState } from '@tanstack/react-table';

/** Initial sort: nombre A → Z. */
export const DEFAULT_CLIENT_SORTING: SortingState = [{ id: 'name', desc: false }];

const SORT_OPTION_ROWS: { value: string; label: string }[] = [
  { value: 'name:asc', label: 'Nombre (A → Z)' },
  { value: 'name:desc', label: 'Nombre (Z → A)' },
  { value: 'id:asc', label: 'ID (menor a mayor)' },
  { value: 'id:desc', label: 'ID (mayor a menor)' },
  { value: 'phone:asc', label: 'Teléfono (A → Z)' },
  { value: 'phone:desc', label: 'Teléfono (Z → A)' },
  { value: 'email:asc', label: 'Correo (A → Z)' },
  { value: 'email:desc', label: 'Correo (Z → A)' },
  { value: 'address:asc', label: 'Dirección (A → Z)' },
  { value: 'address:desc', label: 'Dirección (Z → A)' },
  { value: 'created_at:asc', label: 'Alta (más antiguos)' },
  { value: 'created_at:desc', label: 'Alta (más recientes)' },
];

export const CLIENTS_MOBILE_SORT_OPTIONS = SORT_OPTION_ROWS;

export const encodeSortingState = (sorting: SortingState): string => {
  if (!sorting.length) {
    const d = DEFAULT_CLIENT_SORTING[0];
    return `${d.id}:${d.desc ? 'desc' : 'asc'}`;
  }
  const s = sorting[0];
  return `${s.id}:${s.desc ? 'desc' : 'asc'}`;
};

export const decodeSortingState = (value: string): SortingState => {
  const idx = value.lastIndexOf(':');
  if (idx <= 0) {
    return DEFAULT_CLIENT_SORTING;
  }
  const id = value.slice(0, idx);
  const dir = value.slice(idx + 1);
  return [{ id, desc: dir === 'desc' }];
};
