import type { SortingState } from '@tanstack/react-table';

/** Orden inicial: usuarios más recientes primero (alineado con `getUsers`). */
export const DEFAULT_USERS_SORTING: SortingState = [
  { id: 'created_at', desc: true },
];

const SORT_OPTION_ROWS: { value: string; label: string }[] = [
  { value: 'created_at:desc', label: 'Alta (recientes primero)' },
  { value: 'created_at:asc', label: 'Alta (antiguos primero)' },
  { value: 'name:asc', label: 'Nombre (A → Z)' },
  { value: 'name:desc', label: 'Nombre (Z → A)' },
  { value: 'email:asc', label: 'Correo (A → Z)' },
  { value: 'email:desc', label: 'Correo (Z → A)' },
  { value: 'companyName:asc', label: 'Empresa (A → Z)' },
  { value: 'companyName:desc', label: 'Empresa (Z → A)' },
  { value: 'roleName:asc', label: 'Rol (A → Z)' },
  { value: 'roleName:desc', label: 'Rol (Z → A)' },
  { value: 'id:desc', label: 'ID (mayor a menor)' },
  { value: 'id:asc', label: 'ID (menor a menor)' },
];

export const USERS_MOBILE_SORT_OPTIONS = SORT_OPTION_ROWS;

export const encodeSortingState = (sorting: SortingState): string => {
  if (!sorting.length) {
    const d = DEFAULT_USERS_SORTING[0];
    return `${d.id}:${d.desc ? 'desc' : 'asc'}`;
  }
  const s = sorting[0];
  return `${s.id}:${s.desc ? 'desc' : 'asc'}`;
};

export const decodeSortingState = (value: string): SortingState => {
  const idx = value.lastIndexOf(':');
  if (idx <= 0) {
    return DEFAULT_USERS_SORTING;
  }
  const id = value.slice(0, idx);
  const dir = value.slice(idx + 1);
  return [{ id, desc: dir === 'desc' }];
};
