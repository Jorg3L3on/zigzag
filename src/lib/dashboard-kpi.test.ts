import {
  buildDashboardKpis,
  buildPaymentStatusBreakdown,
  computeDeltaPercent,
  countActiveTicketsSnapshot,
  getTicketOutstanding,
  sumFinishedRevenueInMonth,
  sumOutstandingSnapshot,
} from '@/lib/dashboard-kpi';

describe('computeDeltaPercent', () => {
  it('returns percent change when prior is non-zero', () => {
    expect(computeDeltaPercent(110, 100)).toBeCloseTo(10);
    expect(computeDeltaPercent(90, 100)).toBeCloseTo(-10);
  });

  it('returns 0 when both are zero', () => {
    expect(computeDeltaPercent(0, 0)).toBe(0);
  });

  it('returns 100 when prior is zero and current is positive', () => {
    expect(computeDeltaPercent(50, 0)).toBe(100);
  });
});

describe('getTicketOutstanding', () => {
  it('returns 0 for paid tickets', () => {
    expect(
      getTicketOutstanding({
        finished: true,
        total: 100,
        paid: 100,
        ticket_date: null,
        created_at: new Date(),
      }),
    ).toBe(0);
  });

  it('returns remaining balance for partial payment', () => {
    expect(
      getTicketOutstanding({
        finished: true,
        total: 100,
        paid: 40,
        ticket_date: null,
        created_at: new Date(),
      }),
    ).toBe(60);
  });
});

describe('sumFinishedRevenueInMonth', () => {
  const month = new Date(2026, 4, 1);

  it('only includes finished tickets in the calendar month', () => {
    const tickets = [
      {
        finished: true,
        total: 200,
        paid: 200,
        ticket_date: new Date(2026, 4, 10),
        created_at: new Date(2026, 0, 1),
      },
      {
        finished: true,
        total: 50,
        paid: 0,
        ticket_date: new Date(2026, 3, 10),
        created_at: new Date(2026, 0, 1),
      },
      {
        finished: false,
        total: 999,
        paid: 0,
        ticket_date: new Date(2026, 4, 10),
        created_at: new Date(2026, 0, 1),
      },
    ];
    expect(sumFinishedRevenueInMonth(tickets, month)).toBe(200);
  });
});

describe('buildPaymentStatusBreakdown', () => {
  it('groups tickets by payment status', () => {
    const rows = buildPaymentStatusBreakdown([
      {
        finished: true,
        total: 100,
        paid: 100,
        ticket_date: null,
        created_at: new Date(),
      },
      {
        finished: true,
        total: 80,
        paid: 20,
        ticket_date: null,
        created_at: new Date(),
      },
    ]);
    expect(rows.find((r) => r.status === 'paid')?.count).toBe(1);
    expect(rows.find((r) => r.status === 'partial')?.count).toBe(1);
    expect(rows.find((r) => r.status === 'paid')?.amount).toBe(100);
    expect(rows.find((r) => r.status === 'partial')?.amount).toBe(80);
  });
});

describe('buildDashboardKpis', () => {
  const now = new Date(2026, 4, 15);

  it('returns four KPIs with sparkline points', () => {
    const tickets = [
      {
        finished: true,
        total: 100,
        paid: 100,
        ticket_date: new Date(2026, 4, 5),
        created_at: new Date(2026, 0, 1),
      },
      {
        finished: false,
        total: 80,
        paid: 20,
        ticket_date: new Date(2026, 4, 8),
        created_at: new Date(2026, 0, 1),
      },
    ];
    const kpis = buildDashboardKpis(tickets, now);
    expect(kpis).toHaveLength(4);
    expect(kpis[0].key).toBe('revenue');
    expect(kpis[0].value).toBe(100);
    expect(kpis[0].sparkline.length).toBe(8);
    expect(sumOutstandingSnapshot(tickets)).toBe(60);
    expect(countActiveTicketsSnapshot(tickets)).toBe(1);
    expect(kpis[2].value).toBe(60);
    expect(kpis[3].value).toBe(1);
  });
});
