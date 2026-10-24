import { describe, expect, it } from '@jest/globals';
import {
  buildTechnicianDayQueue,
  formatTechnicianDayServicesSummary,
  getTechnicianDayCardActions,
  isTechnicianDayQueueTicket,
} from '@/lib/technician-day-queue';

describe('technician-day-queue', () => {
  const today = new Date('2026-08-12T15:00:00');

  it('includes unfinished today and overdue, excludes finished and future', () => {
    expect(
      isTechnicianDayQueueTicket(
        {
          id: 1,
          client_name: 'A',
          client_tel: null,
          ticket_date: new Date('2026-08-12T12:00:00.000Z'),
          created_at: new Date('2026-08-12T12:00:00.000Z'),
          total: 100,
          paid: 0,
          finished: false,
        },
        today,
      ),
    ).toBe(true);

    expect(
      isTechnicianDayQueueTicket(
        {
          id: 2,
          client_name: 'B',
          client_tel: null,
          ticket_date: new Date('2026-08-01T12:00:00.000Z'),
          created_at: new Date('2026-08-01T12:00:00.000Z'),
          total: 100,
          paid: 0,
          finished: false,
        },
        today,
      ),
    ).toBe(true);

    expect(
      isTechnicianDayQueueTicket(
        {
          id: 3,
          client_name: 'C',
          client_tel: null,
          ticket_date: new Date('2026-08-12T12:00:00.000Z'),
          created_at: new Date('2026-08-12T12:00:00.000Z'),
          total: 100,
          paid: 0,
          finished: true,
        },
        today,
      ),
    ).toBe(false);

    expect(
      isTechnicianDayQueueTicket(
        {
          id: 4,
          client_name: 'D',
          client_tel: null,
          ticket_date: new Date('2026-08-20T12:00:00.000Z'),
          created_at: new Date('2026-08-20T12:00:00.000Z'),
          total: 100,
          paid: 0,
          finished: false,
        },
        today,
      ),
    ).toBe(false);

    expect(
      isTechnicianDayQueueTicket(
        {
          id: 5,
          client_name: 'Quote',
          client_tel: null,
          ticket_date: new Date('2026-08-12T12:00:00.000Z'),
          created_at: new Date('2026-08-12T12:00:00.000Z'),
          total: 100,
          paid: 0,
          finished: false,
          document_kind: 'presupuesto',
        },
        today,
      ),
    ).toBe(false);
  });

  it('sorts overdue before today and counts buckets', () => {
    const queue = buildTechnicianDayQueue(
      [
        {
          id: 1,
          client_name: 'Hoy',
          client_tel: '555',
          ticket_date: new Date('2026-08-12T12:00:00.000Z'),
          created_at: new Date('2026-08-12T12:00:00.000Z'),
          total: 100,
          paid: 0,
          finished: false,
          serviceNames: ['Fumigación', 'Inspección'],
        },
        {
          id: 2,
          client_name: 'Ayer',
          client_tel: null,
          ticket_date: new Date('2026-08-10T12:00:00.000Z'),
          created_at: new Date('2026-08-10T12:00:00.000Z'),
          total: 80,
          paid: 20,
          finished: false,
        },
      ],
      today,
    );

    expect(queue.items.map((row) => row.id)).toEqual(['2', '1']);
    expect(queue.overdueCount).toBe(1);
    expect(queue.todayCount).toBe(1);
    expect(queue.items[0]?.isOverdue).toBe(true);
    expect(queue.items[1]?.servicesSummary).toBe('Fumigación, Inspección');
  });

  it('keeps an evening CDMX ticket on today, not overdue (ZIG-25)', () => {
    const evening = new Date('2026-10-23T23:00:00-06:00');
    expect(evening.toISOString().slice(0, 10)).toBe('2026-10-24');
    const queue = buildTechnicianDayQueue(
      [
        {
          id: 9,
          client_name: 'Noche',
          client_tel: null,
          ticket_date: evening,
          created_at: evening,
          total: 100,
          paid: 0,
          finished: false,
        },
      ],
      evening,
    );
    expect(queue.todayCount).toBe(1);
    expect(queue.overdueCount).toBe(0);
    expect(queue.items[0]?.isOverdue).toBe(false);
  });

  it('formats services summary with overflow', () => {
    expect(formatTechnicianDayServicesSummary(['A', 'B', 'C', 'D'])).toBe(
      'A, B, C +1 más',
    );
    expect(formatTechnicianDayServicesSummary([])).toBeNull();
    expect(formatTechnicianDayServicesSummary(undefined)).toBeNull();
  });

  it('gates open/edit and collect CTAs by write + finished + saldo', () => {
    expect(
      getTechnicianDayCardActions({
        finished: false,
        balanceDue: 50,
        canWrite: true,
      }),
    ).toEqual({ showOpenEdit: true, showCollect: false });

    expect(
      getTechnicianDayCardActions({
        finished: true,
        balanceDue: 50,
        canWrite: true,
      }),
    ).toEqual({ showOpenEdit: false, showCollect: true });

    expect(
      getTechnicianDayCardActions({
        finished: true,
        balanceDue: 50,
        canWrite: false,
      }),
    ).toEqual({ showOpenEdit: false, showCollect: false });

    expect(
      getTechnicianDayCardActions({
        finished: true,
        balanceDue: 0,
        canWrite: true,
      }),
    ).toEqual({ showOpenEdit: false, showCollect: false });
  });
});
