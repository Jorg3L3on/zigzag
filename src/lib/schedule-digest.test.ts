import { describe, expect, it } from '@jest/globals';
import {
  buildScheduleDigestCopy,
  scheduleDigestDedupeKey,
} from '@/lib/schedule-digest';

describe('schedule-digest', () => {
  it('returns null when both counts are zero', () => {
    expect(buildScheduleDigestCopy({ atrasados: 0, proximos: 0 })).toBeNull();
  });

  it('prefers atrasados filter when any overdue exist', () => {
    expect(buildScheduleDigestCopy({ atrasados: 2, proximos: 3 })).toEqual({
      title: 'Recordatorios de hoy',
      body: 'Tienes 2 atrasados y 3 próximos en la agenda de servicios.',
      filter: 'atrasados',
    });
  });

  it('uses proximos filter when only due-soon', () => {
    expect(buildScheduleDigestCopy({ atrasados: 0, proximos: 1 })).toEqual({
      title: 'Recordatorios de hoy',
      body: 'Tienes 1 próximo en la agenda de servicios.',
      filter: 'proximos',
    });
  });

  it('builds idempotent dedupe keys per company-day', () => {
    const day = new Date('2026-08-12T18:00:00');
    expect(scheduleDigestDedupeKey(9, day)).toBe(
      'schedule-digest:company:9:2026-08-12',
    );
  });
});
