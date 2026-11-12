import type { SortingState } from '@tanstack/react-table';

import type {
  PresupuestoListColumnSort,
  PresupuestoListSortColumn,
} from '@/actions/presupuestos';

/** Vencen primero, as before the header sort (ZIG-I29-3). */
export const DEFAULT_PRESUPUESTO_SORTING: SortingState = [{ id: 'vence', desc: false }];

/** The table's sortable column ids, the same names the server and `?orden=` use. */
const SORT_COLUMNS: readonly PresupuestoListSortColumn[] = [
  'folio',
  'cliente',
  'emitido',
  'vence',
  'total',
];

/** The values of the old sort select: Vencen primero, Más recientes, Mayor total. */
const LEGACY_SORTS: Record<string, SortingState> = {
  vence: DEFAULT_PRESUPUESTO_SORTING,
  recientes: [{ id: 'emitido', desc: true }],
  total: [{ id: 'total', desc: true }],
};

const isSortColumn = (value: string): value is PresupuestoListSortColumn =>
  (SORT_COLUMNS as readonly string[]).includes(value);

/**
 * `?orden=` → sorting (ZIG-I33-2): `total-desc` as the headers write it, the old
 * `vence` / `recientes` / `total`, anything else the default.
 */
export const parsePresupuestoSortParam = (value: string | null | undefined): SortingState => {
  if (!value) return DEFAULT_PRESUPUESTO_SORTING;
  if (Object.prototype.hasOwnProperty.call(LEGACY_SORTS, value)) return LEGACY_SORTS[value];
  const idx = value.lastIndexOf('-');
  const column = value.slice(0, idx);
  const direction = value.slice(idx + 1);
  if (idx <= 0 || !isSortColumn(column) || (direction !== 'asc' && direction !== 'desc')) {
    return DEFAULT_PRESUPUESTO_SORTING;
  }
  return [{ id: column, desc: direction === 'desc' }];
};

/** What the server sorts by for the table's sorting; the default for anything unknown. */
export const presupuestoSortForServer = (sorting: SortingState): PresupuestoListColumnSort => {
  const first = sorting[0];
  const chosen = first && isSortColumn(first.id) ? first : DEFAULT_PRESUPUESTO_SORTING[0];
  return {
    column: chosen.id as PresupuestoListSortColumn,
    direction: chosen.desc ? 'desc' : 'asc',
  };
};

/** sorting → `?orden=` (`total-desc`); null for the default, which stays out of the URL. */
export const presupuestoSortParam = (sorting: SortingState): string | null => {
  const { column, direction } = presupuestoSortForServer(sorting);
  const fallback = presupuestoSortForServer(DEFAULT_PRESUPUESTO_SORTING);
  if (column === fallback.column && direction === fallback.direction) return null;
  return `${column}-${direction}`;
};
