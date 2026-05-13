import type { SortingState } from '@tanstack/react-table';

/** Initial sort: nombre A → Z. */
export const DEFAULT_PERMISSION_SORTING: SortingState = [
  { id: 'name', desc: false },
];

const SORT_OPTION_ROWS: { value: string; label: string }[] = [
  { value: 'name:asc', label: 'Nombre (A → Z)' },
  { value: 'name:desc', label: 'Nombre (Z → A)' },
  { value: 'companyName:asc', label: 'Empresa (A → Z)' },
  { value: 'companyName:desc', label: 'Empresa (Z → A)' },
  { value: 'description:asc', label: 'Descripción (A → Z)' },
  { value: 'description:desc', label: 'Descripción (Z → A)' },
  { value: 'created_at:asc', label: 'Fecha (más antigua)' },
  { value: 'created_at:desc', label: 'Fecha (más reciente)' },
];

export const PERMISSIONS_MOBILE_SORT_OPTIONS = SORT_OPTION_ROWS;

export const encodeSortingState = (sorting: SortingState): string => {
  if (!sorting.length) {
    const d = DEFAULT_PERMISSION_SORTING[0];
    return `${d.id}:${d.desc ? 'desc' : 'asc'}`;
  }
  const s = sorting[0];
  return `${s.id}:${s.desc ? 'desc' : 'asc'}`;
};

export const decodeSortingState = (value: string): SortingState => {
  const idx = value.lastIndexOf(':');
  if (idx <= 0) {
    return DEFAULT_PERMISSION_SORTING;
  }
  const id = value.slice(0, idx);
  const dir = value.slice(idx + 1);
  return [{ id, desc: dir === 'desc' }];
};
