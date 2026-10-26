import type { PresupuestoStatus } from '@/lib/ticket-document-kind';

/**
 * Desktop views of the presupuestos list (ZIG-I29-3). `pendientes` is the
 * default, Abiertos + Vencidos as on the phone; each other view is one
 * `?estado=` value.
 */
export type PresupuestoListView =
  | 'pendientes'
  | 'abiertos'
  | 'vencidos'
  | 'aceptados'
  | 'cancelados'
  | 'todos';

export type PresupuestoListSort = 'vence' | 'recientes' | 'total';

/** Counts per state under the search and the dates; never amounts (f18a2f7d). */
export type PresupuestoListCounts = {
  all: number;
  abierto: number;
  vencido: number;
  convertido: number;
  cancelado: number;
  /** Open ones that expire today, for «k vencen hoy» on Abiertos. */
  venceHoy: number;
};

const VIEW_STATUSES: Record<PresupuestoListView, PresupuestoStatus[] | null> = {
  pendientes: ['abierto', 'vencido'],
  abiertos: ['abierto'],
  vencidos: ['vencido'],
  aceptados: ['convertido'],
  cancelados: ['cancelado'],
  todos: null,
};

/** The states a view shows; null means all four. */
export const statusesForPresupuestoView = (
  view: PresupuestoListView,
): PresupuestoStatus[] | null => VIEW_STATUSES[view];

/** `?estado=`; anything unknown (or nothing) is the default Abiertos + Vencidos. */
export const parsePresupuestoView = (value: string | null | undefined): PresupuestoListView =>
  value === 'abiertos' ||
  value === 'vencidos' ||
  value === 'aceptados' ||
  value === 'cancelados' ||
  value === 'todos'
    ? value
    : 'pendientes';

export const parsePresupuestoSort = (value: string | null | undefined): PresupuestoListSort =>
  value === 'recientes' || value === 'total' ? value : 'vence';

export const PRESUPUESTO_SORT_LABEL: Record<PresupuestoListSort, string> = {
  vence: 'Vencen primero',
  recientes: 'Más recientes',
  total: 'Mayor total',
};
