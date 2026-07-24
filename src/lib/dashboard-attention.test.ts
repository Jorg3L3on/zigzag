import {
  buildDashboardAttentionItems,
  countSchedulesDueToday,
} from '@/lib/dashboard-attention';
import type { PaymentStatusBreakdownItem } from '@/lib/dashboard-kpi';

const breakdown = (
  overrides: Partial<Record<'paid' | 'partial' | 'pending', number>> = {},
): PaymentStatusBreakdownItem[] => [
  {
    status: 'paid',
    label: 'Saldado',
    count: overrides.paid ?? 0,
    amount: 0,
  },
  {
    status: 'partial',
    label: 'Pago parcial',
    count: overrides.partial ?? 0,
    amount: 50,
  },
  {
    status: 'pending',
    label: 'Pendiente',
    count: overrides.pending ?? 0,
    amount: 100,
  },
];

describe('dashboard-attention', () => {
  it('omits zero-count and unavailable schedule metrics', () => {
    const items = buildDashboardAttentionItems({
      paymentStatusBreakdown: breakdown(),
      activeTickets: 0,
      overdueSchedules: null,
      dueTodaySchedules: null,
    });

    expect(items).toEqual([]);
  });

  it('builds actionable attention rows with filtered CTAs', () => {
    const items = buildDashboardAttentionItems({
      paymentStatusBreakdown: breakdown({ pending: 12, partial: 3 }),
      activeTickets: 5,
      overdueSchedules: 2,
      dueTodaySchedules: 1,
    });

    expect(items.map((item) => item.key)).toEqual([
      'schedules-overdue',
      'schedules-today',
      'tickets-pending-payment',
      'tickets-partial-payment',
      'tickets-active',
    ]);
    expect(items[0]).toMatchObject({
      count: 2,
      href: '/service-schedules?filter=atrasados',
      tone: 'urgent',
    });
    expect(items[2]).toMatchObject({
      count: 12,
      href: '/tickets?status=pending',
      ctaLabel: 'Ver tickets',
    });
    expect(items[4]).toMatchObject({
      count: 5,
      href: '/tickets?finished=no',
    });
  });

  it('counts schedules due today from nextDueAt', () => {
    const today = new Date('2026-07-24T15:00:00');
    const count = countSchedulesDueToday(
      [
        { nextDueAt: '2026-07-24T09:00:00' },
        { nextDueAt: '2026-07-25T09:00:00' },
        { nextDueAt: new Date('2026-07-24T23:00:00') },
      ],
      today,
    );
    expect(count).toBe(2);
  });
});
