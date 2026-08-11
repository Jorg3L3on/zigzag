import { describe, expect, it } from '@jest/globals';
import {
  applyCobranzaPaymentToRows,
  buildCobranzaRows,
  compareCobranzaUrgency,
  filterCobranzaRows,
  getAgingBucket,
  getDaysOutstanding,
  summarizeCobranzaRows,
  toCobranzaRow,
  type CobranzaTicketInput,
} from '@/lib/cobranza';

const baseTicket = (
  overrides: Partial<CobranzaTicketInput> & { id: number },
): CobranzaTicketInput => ({
  id: overrides.id,
  client_name: overrides.client_name ?? 'Cliente',
  client_tel: overrides.client_tel ?? '555',
  ticket_date: overrides.ticket_date ?? new Date('2026-01-01T12:00:00'),
  created_at: overrides.created_at ?? new Date('2026-01-01T12:00:00'),
  total: overrides.total ?? 100,
  paid: overrides.paid ?? 0,
  finished: overrides.finished ?? true,
  company_id: overrides.company_id ?? 1,
});

describe('cobranza helpers', () => {
  const now = new Date('2026-02-01T15:00:00');

  it('computes days outstanding from ticket_date', () => {
    expect(
      getDaysOutstanding(new Date('2026-01-01T23:00:00'), now),
    ).toBe(31);
  });

  it('maps aging buckets', () => {
    expect(getAgingBucket(0)).toBe('0-14');
    expect(getAgingBucket(14)).toBe('0-14');
    expect(getAgingBucket(15)).toBe('15-30');
    expect(getAgingBucket(30)).toBe('15-30');
    expect(getAgingBucket(31)).toBe('30+');
  });

  it('excludes fully paid and zero-balance tickets', () => {
    expect(
      toCobranzaRow(baseTicket({ id: 1, total: 100, paid: 100 }), now),
    ).toBeNull();
    expect(
      toCobranzaRow(baseTicket({ id: 2, total: 0, paid: 0 }), now),
    ).toBeNull();
  });

  it('builds outstanding rows with balance and status', () => {
    const row = toCobranzaRow(
      baseTicket({ id: 3, total: 200, paid: 50 }),
      now,
    );
    expect(row).toMatchObject({
      id: '3',
      balanceDue: 150,
      paymentStatus: 'partial',
      agingBucket: '30+',
    });
  });

  it('sorts pending before partial, then older, then larger saldo', () => {
    const pendingOld = toCobranzaRow(
      baseTicket({
        id: 1,
        total: 50,
        paid: 0,
        ticket_date: new Date('2026-01-01'),
      }),
      now,
    )!;
    const pendingNew = toCobranzaRow(
      baseTicket({
        id: 2,
        total: 80,
        paid: 0,
        ticket_date: new Date('2026-01-20'),
      }),
      now,
    )!;
    const partial = toCobranzaRow(
      baseTicket({
        id: 3,
        total: 200,
        paid: 50,
        ticket_date: new Date('2025-12-01'),
      }),
      now,
    )!;

    const sorted = [partial, pendingNew, pendingOld].sort(compareCobranzaUrgency);
    expect(sorted.map((row) => row.id)).toEqual(['1', '2', '3']);
  });

  it('filters by status, aging, and client search', () => {
    const rows = buildCobranzaRows(
      [
        baseTicket({
          id: 1,
          client_name: 'Ana',
          total: 100,
          paid: 0,
          ticket_date: new Date('2026-01-25'),
        }),
        baseTicket({
          id: 2,
          client_name: 'Bruno',
          total: 100,
          paid: 40,
          ticket_date: new Date('2025-12-01'),
        }),
      ],
      now,
    );

    expect(filterCobranzaRows(rows, { status: 'pending' })).toHaveLength(1);
    expect(filterCobranzaRows(rows, { aging: '30+' })[0]?.id).toBe('2');
    expect(filterCobranzaRows(rows, { search: 'bru' })[0]?.client_name).toBe(
      'Bruno',
    );
  });

  it('summarizes count and balance sum', () => {
    const rows = buildCobranzaRows(
      [
        baseTicket({ id: 1, total: 100, paid: 0 }),
        baseTicket({ id: 2, total: 80, paid: 30 }),
      ],
      now,
    );
    expect(summarizeCobranzaRows(rows)).toEqual({
      count: 2,
      balanceSum: 150,
    });
  });

  it('removes fully paid tickets after payment and updates partials', () => {
    const rows = buildCobranzaRows(
      [
        baseTicket({ id: 1, total: 100, paid: 0 }),
        baseTicket({ id: 2, total: 80, paid: 20 }),
      ],
      now,
    );

    const afterFull = applyCobranzaPaymentToRows(
      rows,
      { ticketId: 1, paid: 100, total: 100 },
      now,
    );
    expect(afterFull.map((row) => row.id)).toEqual(['2']);

    const afterPartial = applyCobranzaPaymentToRows(
      afterFull,
      { ticketId: 2, paid: 50, total: 80 },
      now,
    );
    expect(afterPartial).toHaveLength(1);
    expect(afterPartial[0]).toMatchObject({
      id: '2',
      paid: 50,
      balanceDue: 30,
      paymentStatus: 'partial',
    });
  });
});
