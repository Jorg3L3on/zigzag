import { formatRelativeActivityTime } from '@/lib/format-relative-time';

describe('formatRelativeActivityTime', () => {
  const now = new Date('2026-07-24T15:00:00.000Z');

  it('returns Ahora mismo for sub-minute deltas', () => {
    expect(
      formatRelativeActivityTime('2026-07-24T14:59:30.000Z', now),
    ).toBe('Ahora mismo');
  });

  it('returns minute and hour buckets', () => {
    expect(
      formatRelativeActivityTime('2026-07-24T14:55:00.000Z', now),
    ).toBe('Hace 5 minutos');
    expect(
      formatRelativeActivityTime('2026-07-24T13:00:00.000Z', now),
    ).toBe('Hace 2 horas');
  });

  it('returns Ayer and last-week buckets', () => {
    expect(
      formatRelativeActivityTime('2026-07-23T10:00:00.000Z', now),
    ).toBe('Ayer');
    expect(
      formatRelativeActivityTime('2026-07-16T15:00:00.000Z', now),
    ).toBe('La semana pasada');
  });
});
