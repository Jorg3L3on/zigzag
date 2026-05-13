import type { SortingState } from '@tanstack/react-table';

/** Initial sort: nombre A → Z. */
export const DEFAULT_SERVICE_SORTING: SortingState = [{ id: 'name', desc: false }];

const SORT_OPTION_ROWS: { value: string; label: string }[] = [
  { value: 'name:asc', label: 'Nombre (A → Z)' },
  { value: 'name:desc', label: 'Nombre (Z → A)' },
  { value: 'description:asc', label: 'Descripción (A → Z)' },
  { value: 'description:desc', label: 'Descripción (Z → A)' },
  { value: 'status:asc', label: 'Estado (activos primero)' },
  { value: 'status:desc', label: 'Estado (eliminados primero)' },
  { value: 'price:asc', label: 'Precio (menor a mayor)' },
  { value: 'price:desc', label: 'Precio (mayor a menor)' },
];

export const SERVICES_MOBILE_SORT_OPTIONS = SORT_OPTION_ROWS;

export const encodeSortingState = (sorting: SortingState): string => {
  if (!sorting.length) {
    const d = DEFAULT_SERVICE_SORTING[0];
    return `${d.id}:${d.desc ? 'desc' : 'asc'}`;
  }
  const s = sorting[0];
  return `${s.id}:${s.desc ? 'desc' : 'asc'}`;
};

export const decodeSortingState = (value: string): SortingState => {
  const idx = value.lastIndexOf(':');
  if (idx <= 0) {
    return DEFAULT_SERVICE_SORTING;
  }
  const id = value.slice(0, idx);
  const dir = value.slice(idx + 1);
  return [{ id, desc: dir === 'desc' }];
};
