import {
  aggregateFinishedRevenueByMonthKey,
  buildMonthBuckets,
  parseDashboardMonthCount,
  toRevenueByMonthPoints,
} from '@/lib/dashboard-metrics';

describe('parseDashboardMonthCount', () => {
  it('accepts 1, 3, 6, 12', () => {
    expect(parseDashboardMonthCount(1)).toBe(1);
    expect(parseDashboardMonthCount(3)).toBe(3);
    expect(parseDashboardMonthCount(6)).toBe(6);
    expect(parseDashboardMonthCount(12)).toBe(12);
  });

  it('defaults invalid values to 1', () => {
    expect(parseDashboardMonthCount('x')).toBe(1);
    expect(parseDashboardMonthCount(undefined)).toBe(1);
  });
});

describe('buildMonthBuckets', () => {
  it('returns the requested number of month starts', () => {
    const now = new Date(2026, 4, 15);
    expect(buildMonthBuckets(3, now)).toHaveLength(3);
    expect(buildMonthBuckets(12, now)).toHaveLength(12);
  });
});

describe('aggregateFinishedRevenueByMonthKey', () => {
  const buckets = [
    new Date(2026, 2, 1),
    new Date(2026, 3, 1),
    new Date(2026, 4, 1),
  ];

  it('only counts finished tickets with total', () => {
    const tickets = [
      {
        finished: false,
        total: 100,
        ticket_date: new Date(2026, 3, 10),
        created_at: new Date(2026, 1, 1),
      },
      {
        finished: true,
        total: null,
        ticket_date: new Date(2026, 3, 10),
        created_at: new Date(2026, 1, 1),
      },
    ];
    const map = aggregateFinishedRevenueByMonthKey(tickets, buckets);
    expect(map.get('2026-03')).toBe(0);
    expect(map.get('2026-04')).toBe(0);
  });

  it('buckets by start of month of ticket_date when present', () => {
    const tickets = [
      {
        finished: true,
        total: 50,
        ticket_date: new Date(2026, 2, 20),
        created_at: new Date(2026, 0, 1),
      },
    ];
    const map = aggregateFinishedRevenueByMonthKey(tickets, buckets);
    expect(map.get('2026-03')).toBe(50);
    expect(map.get('2026-04')).toBe(0);
  });

  it('falls back to created_at when ticket_date is null', () => {
    const tickets = [
      {
        finished: true,
        total: 25,
        ticket_date: null,
        created_at: new Date(2026, 4, 5),
      },
    ];
    const map = aggregateFinishedRevenueByMonthKey(tickets, buckets);
    expect(map.get('2026-05')).toBe(25);
  });

  it('ignores months outside the bucket range', () => {
    const tickets = [
      {
        finished: true,
        total: 99,
        ticket_date: new Date(2025, 0, 1),
        created_at: new Date(2025, 0, 1),
      },
    ];
    const map = aggregateFinishedRevenueByMonthKey(tickets, buckets);
    expect(map.get('2026-03')).toBe(0);
    expect(map.get('2026-04')).toBe(0);
    expect(map.get('2026-05')).toBe(0);
  });
});

describe('toRevenueByMonthPoints', () => {
  it('maps bucket order to points with revenue from map', () => {
    const buckets = [new Date(2026, 3, 1), new Date(2026, 4, 1)];
    const map = new Map<string, number>([
      ['2026-04', 10],
      ['2026-05', 20],
    ]);
    const points = toRevenueByMonthPoints(buckets, map);
    expect(points).toHaveLength(2);
    expect(points[0].monthKey).toBe('2026-04');
    expect(points[0].revenue).toBe(10);
    expect(points[1].revenue).toBe(20);
  });
});
