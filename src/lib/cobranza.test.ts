import { describe, expect, it } from '@jest/globals';
import {
  applyCobranzaPaymentToRows,
  buildCobranzaRows,
  compareCobranzaUrgency,
  filterCobranzaRows,
  getAgingBucket,
  getDaysOutstanding,
  groupCobranzaRowsByClient,
  sortCobranzaRows,
  summarizeCobranzaBuckets,
  summarizeCobranzaRows,
  toCobranzaRow,
  type CobranzaTicketInput,
} from '@/lib/cobranza';

const baseTicket = (
  overrides: Partial<CobranzaTicketInput> & { id: number },
): CobranzaTicketInput => ({
  id: overrides.id,
  client_name: overrides.client_name ?? 'Cliente',
  client_tel: overrides.client_tel === undefined ? '555' : overrides.client_tel,
  ticket_date: overrides.ticket_date ?? new Date('2026-01-01T12:00:00'),
  created_at: overrides.created_at ?? new Date('2026-01-01T12:00:00'),
  total: overrides.total ?? 100,
  paid: overrides.paid ?? 0,
  finished: overrides.finished ?? true,
  company_id: overrides.company_id ?? 1,
  document_kind: overrides.document_kind ?? 'ticket',
  client_id: overrides.client_id ?? null,
  folio_number: overrides.folio_number ?? null,
  folio_prefix: overrides.folio_prefix ?? null,
  last_payment_at: overrides.last_payment_at ?? null,
  services_summary: overrides.services_summary ?? null,
});

describe('cobranza helpers', () => {
  const now = new Date('2026-02-01T15:00:00');

  it('computes days outstanding from ticket_date', () => {
    expect(
      getDaysOutstanding(new Date('2026-01-01T23:00:00'), now),
    ).toBe(31);
  });

  it('maps aging buckets 0–30 / 31–90 / más de 90 (ZIG-I31)', () => {
    expect(getAgingBucket(0)).toBe('0-30');
    expect(getAgingBucket(30)).toBe('0-30');
    expect(getAgingBucket(31)).toBe('31-90');
    expect(getAgingBucket(90)).toBe('31-90');
    expect(getAgingBucket(91)).toBe('90+');
  });

  it('counts days in the company calendar, so the 30 and 90 edges follow Mexico City', () => {
    // 2026-03-03 01:00 UTC is still 2 March in Mexico City (UTC−6).
    const evening = new Date('2026-03-03T01:00:00Z');
    const work = new Date('2026-01-31T18:00:00Z');
    expect(getDaysOutstanding(work, evening)).toBe(30);
    expect(getAgingBucket(getDaysOutstanding(work, evening))).toBe('0-30');
    // One hour later in Mexico City it is still the 2nd; at 06:00 UTC it is the 3rd.
    expect(getDaysOutstanding(work, new Date('2026-03-03T06:00:00Z'))).toBe(31);

    const ninety = toCobranzaRow(
      baseTicket({ id: 1, ticket_date: new Date('2026-01-01T18:00:00Z') }),
      new Date('2026-04-02T05:59:00Z'),
    )!;
    expect(ninety.daysOutstanding).toBe(90);
    expect(ninety.agingBucket).toBe('31-90');
    const ninetyOne = toCobranzaRow(
      baseTicket({ id: 1, ticket_date: new Date('2026-01-01T18:00:00Z') }),
      new Date('2026-04-02T06:00:00Z'),
    )!;
    expect(ninetyOne.daysOutstanding).toBe(91);
    expect(ninetyOne.agingBucket).toBe('90+');
  });

  it('leaves En proceso tickets out even with a total (ZIG-I31)', () => {
    expect(
      toCobranzaRow(baseTicket({ id: 1, total: 900, paid: 0, finished: false }), now),
    ).toBeNull();
    expect(
      buildCobranzaRows(
        [
          baseTicket({ id: 1, total: 900, finished: false }),
          baseTicket({ id: 2, total: 100, finished: true }),
        ],
        now,
      ).map((row) => row.id),
    ).toEqual(['2']);
  });

  it('counts days from the work date and keeps days since the last payment apart', () => {
    const row = toCobranzaRow(
      baseTicket({
        id: 4,
        total: 500,
        paid: 100,
        ticket_date: new Date('2026-01-17T18:00:00Z'),
        last_payment_at: new Date('2026-01-31T18:00:00Z'),
      }),
      now,
    )!;
    expect(row.daysOutstanding).toBe(15);
    expect(row.daysSinceLastPayment).toBe(1);
    expect(
      toCobranzaRow(baseTicket({ id: 5, total: 100 }), now)!.daysSinceLastPayment,
    ).toBeNull();
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
      agingBucket: '31-90',
    });
  });

  it('orders by days since the work, oldest first, then larger saldo', () => {
    const row = (o: Partial<CobranzaTicketInput> & { id: number }) =>
      toCobranzaRow(baseTicket(o), now)!;
    const old = row({ id: 1, total: 50, ticket_date: new Date('2026-01-01') });
    const newer = row({ id: 2, total: 80, ticket_date: new Date('2026-01-20') });
    // Old work with a recent partial payment still counts from the work date.
    const recentlyPaid = row({
      id: 3,
      total: 200,
      paid: 50,
      ticket_date: new Date('2025-12-01T18:00:00Z'),
      last_payment_at: new Date('2026-01-28T18:00:00Z'),
    });
    // Tie with `newer` on date: larger saldo goes first, then lower id.
    const tieBig = row({ id: 4, total: 500, ticket_date: new Date('2026-01-20') });
    const tieSameBalance = row({ id: 5, total: 500, ticket_date: new Date('2026-01-20') });

    const sorted = [recentlyPaid, newer, tieSameBalance, old, tieBig].sort(
      compareCobranzaUrgency,
    );
    expect(sorted.map((r) => r.id)).toEqual(['3', '1', '4', '5', '2']);
    expect(recentlyPaid.daysOutstanding).toBe(62);
    expect(recentlyPaid.daysSinceLastPayment).toBe(4);
  });

  it('sortCobranzaRows supports saldo and recent orders', () => {
    const rows = buildCobranzaRows(
      [
        baseTicket({ id: 1, total: 50, ticket_date: new Date('2026-01-01') }),
        baseTicket({ id: 2, total: 900, ticket_date: new Date('2026-01-10') }),
        baseTicket({ id: 3, total: 300, ticket_date: new Date('2026-01-25') }),
      ],
      now,
    );
    expect(sortCobranzaRows(rows, 'days').map((r) => r.id)).toEqual(['1', '2', '3']);
    expect(sortCobranzaRows(rows, 'balance').map((r) => r.id)).toEqual(['2', '3', '1']);
    expect(sortCobranzaRows(rows, 'recent').map((r) => r.id)).toEqual(['3', '2', '1']);
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
    expect(filterCobranzaRows(rows, { aging: '31-90' })[0]?.id).toBe('2');
    expect(filterCobranzaRows(rows, { search: 'bru' })[0]?.client_name).toBe(
      'Bruno',
    );
  });

  it('searches by folio and phone too', () => {
    const rows = buildCobranzaRows(
      [
        baseTicket({ id: 1, client_name: 'Ana', client_tel: '9611112222', folio_number: 16, folio_prefix: 'R' }),
        baseTicket({ id: 2, client_name: 'Bruno', client_tel: '5550000000', folio_number: 36, folio_prefix: 'R' }),
      ],
      now,
    );
    expect(filterCobranzaRows(rows, { search: 'r-0036' }).map((r) => r.id)).toEqual(['2']);
    expect(filterCobranzaRows(rows, { search: '96111' }).map((r) => r.id)).toEqual(['1']);
  });

  it('sums each bucket, and the buckets add up to the total por cobrar', () => {
    const rows = buildCobranzaRows(
      [
        baseTicket({ id: 1, client_id: 7, total: 100, ticket_date: new Date('2026-01-25T18:00:00Z') }),
        baseTicket({ id: 2, client_id: 7, total: 250, paid: 50, ticket_date: new Date('2025-12-01T18:00:00Z') }),
        baseTicket({ id: 3, client_name: 'Sin registro', total: 400, ticket_date: new Date('2025-09-01T18:00:00Z') }),
        baseTicket({ id: 4, client_name: 'Sin registro', total: 999, finished: false }),
      ],
      now,
    );
    const summary = summarizeCobranzaBuckets(rows);
    expect(summary['0-30']).toEqual({ count: 1, amount: 100 });
    expect(summary['31-90']).toEqual({ count: 1, amount: 200 });
    expect(summary['90+']).toEqual({ count: 1, amount: 400 });
    expect(summary.all).toEqual({ count: 3, amount: 700 });
    expect(
      summary['0-30'].amount + summary['31-90'].amount + summary['90+'].amount,
    ).toBe(summary.all.amount);
    expect(summary.clients).toBe(2);
    expect(summary.averageDays).toBe(Math.round((7 + 62 + 153) / 3));
    expect(summarizeCobranzaBuckets([]).averageDays).toBe(0);
  });

  it('groups by client: one row per client with the sum, the oldest work and the last payment', () => {
    const rows = buildCobranzaRows(
      [
        baseTicket({
          id: 16,
          client_id: 12,
          client_name: 'Museo de Arte Contemporáneo',
          client_tel: null,
          total: 1210,
          ticket_date: new Date('2026-01-02T18:00:00Z'),
        }),
        baseTicket({
          id: 36,
          client_id: 12,
          client_name: 'Museo de Arte Contemporáneo',
          client_tel: '9613151559',
          total: 2000,
          paid: 400,
          ticket_date: new Date('2026-01-20T18:00:00Z'),
          last_payment_at: new Date('2026-01-25T18:00:00Z'),
        }),
        baseTicket({ id: 40, client_id: 13, client_name: 'Ana', total: 5000 }),
        baseTicket({ id: 41, client_name: ' ana ', total: 10 }),
      ],
      now,
    );
    const groups = groupCobranzaRowsByClient(rows);
    expect(groups.map((g) => g.client_name)).toEqual([
      'Ana',
      'Museo de Arte Contemporáneo',
      ' ana ',
    ]);
    const museo = groups[1];
    expect(museo.balanceDue).toBe(2810);
    expect(museo.tickets.map((t) => t.id)).toEqual(['16', '36']);
    expect(museo.oldestDays).toBe(30);
    expect(museo.client_tel).toBe('9613151559');
    expect(museo.last_payment_at).toEqual(new Date('2026-01-25T18:00:00Z'));
  });

  it('filters to the tickets of one client', () => {
    const rows = buildCobranzaRows(
      [
        baseTicket({ id: 1, client_id: 7, total: 100, paid: 0 }),
        baseTicket({ id: 2, client_id: 8, total: 100, paid: 0 }),
        baseTicket({ id: 3, client_id: null, total: 100, paid: 0 }),
      ],
      now,
    );

    expect(rows.find((row) => row.id === '1')?.client_id).toBe(7);
    expect(
      filterCobranzaRows(rows, { clientId: 7 }).map((row) => row.id),
    ).toEqual(['1']);
    expect(filterCobranzaRows(rows, { clientId: null })).toHaveLength(3);
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
      daysSinceLastPayment: 0,
    });
  });

  it('keeps the folio and client after a partial payment', () => {
    const rows = buildCobranzaRows(
      [baseTicket({ id: 9, client_id: 4, total: 80, folio_number: 61, folio_prefix: 'R' })],
      now,
    );
    const [after] = applyCobranzaPaymentToRows(
      rows,
      { ticketId: 9, paid: 30, total: 80 },
      now,
    );
    expect(after.folio).toBe('R-0061');
    expect(after.client_id).toBe(4);
  });

  it('excludes presupuestos from cobranza rows', () => {
    expect(
      toCobranzaRow(
        baseTicket({
          id: 99,
          document_kind: 'presupuesto',
          total: 200,
          paid: 0,
        }),
        now,
      ),
    ).toBeNull();
  });
});
