/**
 * Pure helpers for schedule daily digests (idempotent in-app notifications).
 */

import { format, startOfDay } from 'date-fns';

export const SCHEDULE_DAILY_DIGEST_TYPE = 'schedule_daily_digest';

export type ScheduleDigestCounts = {
  atrasados: number;
  proximos: number;
};

export const scheduleDigestDedupeKey = (
  companyId: number,
  day: Date,
): string => `schedule-digest:company:${companyId}:${format(startOfDay(day), 'yyyy-MM-dd')}`;

export const buildScheduleDigestCopy = (
  counts: ScheduleDigestCounts,
): { title: string; body: string; filter: 'atrasados' | 'proximos' } | null => {
  const atrasados = Math.max(0, counts.atrasados);
  const proximos = Math.max(0, counts.proximos);
  if (atrasados === 0 && proximos === 0) {
    return null;
  }

  const parts: string[] = [];
  if (atrasados > 0) {
    parts.push(
      atrasados === 1 ? '1 atrasado' : `${atrasados} atrasados`,
    );
  }
  if (proximos > 0) {
    parts.push(
      proximos === 1 ? '1 próximo' : `${proximos} próximos`,
    );
  }

  return {
    title: 'Recordatorios de hoy',
    body: `Tienes ${parts.join(' y ')} en la agenda de servicios.`,
    filter: atrasados > 0 ? 'atrasados' : 'proximos',
  };
};
