import {
  DEFAULT_SCHEDULE_AGENDA_SORT,
  DEFAULT_SCHEDULE_AGENDA_VIEW,
  isScheduleAgendaSort,
  isScheduleAgendaView,
  isScheduleFilterBucket,
  type ScheduleAgendaSort,
  type ScheduleAgendaView,
} from '@/lib/schedule-buckets';

/**
 * URL state of the agenda (ZIG-I30): `?vista=` (por-atender by default),
 * `?servicio=`, `?orden=`, `?pagina=`, `?ver=<id>` for the side panel. The old
 * `?filter=` (Hoy links `filter=atrasados|proximos`) still works as an alias.
 */
export type ScheduleAgendaParams = {
  view: ScheduleAgendaView;
  serviceId: number | null;
  sort: ScheduleAgendaSort;
  page: number;
  openId: number | null;
};

export const SCHEDULE_AGENDA_PAGE_SIZE = 25;

type ReadableParams = { get: (name: string) => string | null };

const positiveInt = (raw: string | null): number | null => {
  if (!raw || !/^\d+$/.test(raw)) return null;
  const value = Number(raw);
  return value > 0 ? value : null;
};

export const parseScheduleAgendaParams = (
  params: ReadableParams,
): ScheduleAgendaParams => {
  const vista = params.get('vista');
  const legacy = params.get('filter');
  const view =
    vista && isScheduleAgendaView(vista)
      ? vista
      : legacy && isScheduleFilterBucket(legacy)
        ? legacy
        : DEFAULT_SCHEDULE_AGENDA_VIEW;
  const orden = params.get('orden');
  return {
    view,
    serviceId: positiveInt(params.get('servicio')),
    sort: orden && isScheduleAgendaSort(orden) ? orden : DEFAULT_SCHEDULE_AGENDA_SORT,
    page: positiveInt(params.get('pagina')) ?? 1,
    openId: positiveInt(params.get('ver')),
  };
};

/**
 * The query string for `next` on top of `current`, dropping defaults and the
 * legacy `filter` once a view is chosen.
 */
export const buildScheduleAgendaQuery = (
  current: URLSearchParams,
  next: Partial<ScheduleAgendaParams>,
): string => {
  const params = new URLSearchParams(current.toString());
  const set = (name: string, value: string | null) => {
    if (value == null) params.delete(name);
    else params.set(name, value);
  };
  if ('view' in next) {
    params.delete('filter');
    set('vista', next.view === DEFAULT_SCHEDULE_AGENDA_VIEW ? null : next.view ?? null);
  }
  if ('serviceId' in next) set('servicio', next.serviceId ? String(next.serviceId) : null);
  if ('sort' in next) {
    set('orden', next.sort === DEFAULT_SCHEDULE_AGENDA_SORT ? null : next.sort ?? null);
  }
  if ('page' in next) set('pagina', next.page && next.page > 1 ? String(next.page) : null);
  if ('openId' in next) set('ver', next.openId ? String(next.openId) : null);
  return params.toString();
};

/** Por atender groups atrasados and próximos: its tab stays selected for both. */
export const scheduleAgendaTab = (view: ScheduleAgendaView): ScheduleAgendaView =>
  view === 'atrasados' || view === 'proximos' ? 'por-atender' : view;
