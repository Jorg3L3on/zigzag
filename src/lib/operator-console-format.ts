import { format, formatDistanceToNowStrict } from 'date-fns';
import { es } from 'date-fns/locale';
import type { CompanyLifecycleStatus } from '@/db/schema';
import type { ListStatusTone } from '@/components/list-page/list-status-pill';
import { formatListShortDate } from '@/lib/list-short-date';

/** Lifecycle pill tones of the console (canvas): setup blue, active emerald, suspended red, archived slate. */
export const LIFECYCLE_TONE: Record<CompanyLifecycleStatus, ListStatusTone> = {
  SETUP: 'blue',
  ACTIVE: 'emerald',
  SUSPENDED: 'red',
  ARCHIVED: 'slate',
};

/** «hace 12 minutos», «hace 4 horas», «hace 3 días»… or «—» when there is no date. */
export const formatRelative = (iso: string | null | undefined): string => {
  if (!iso) return '—';
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return '—';
  if (Date.now() - date.getTime() < 60 * 1000) return 'hace un momento';
  return formatDistanceToNowStrict(date, { addSuffix: true, locale: es });
};

/** «el 8 nov» in the company calendar. */
export const formatOnDay = (iso: string | null | undefined): string =>
  iso ? `el ${formatListShortDate(iso)}` : '';

/** «3 mar 2026». */
export const formatFullDay = (iso: string | null | undefined): string => {
  if (!iso) return '';
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return '';
  return format(date, 'd MMM yyyy', { locale: es });
};

/** «hoy 09:12», «ayer 18:40», «9 nov 10:15». */
export const formatWhenShort = (iso: string, now: Date = new Date()): string => {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return '';
  const time = format(date, 'HH:mm');
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const startOfYesterday = new Date(startOfToday.getTime() - 24 * 60 * 60 * 1000);
  if (date >= startOfToday) return `hoy ${time}`;
  if (date >= startOfYesterday) return `ayer ${time}`;
  return `${formatListShortDate(date, now)} ${time}`;
};

export const plural = (count: number, one: string, many: string): string =>
  `${count} ${count === 1 ? one : many}`;
