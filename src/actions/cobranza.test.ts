const mockRequireTicketRead = jest.fn();
const mockSelect = jest.fn();

jest.mock('@/lib/tickets-rbac-server', () => ({
  requireTicketRead: (...args: unknown[]) => mockRequireTicketRead(...args),
}));
jest.mock('@/lib/db', () => ({
  db: {
    select: (...args: unknown[]) => mockSelect(...args),
  },
}));

import { getCobranzaList, getCobranzaPaginated } from '@/actions/cobranza';

/** A query builder that resolves to `result` whatever the chain ends with. */
const chain = (result: unknown[]) => {
  const node: Record<string, unknown> = {};
  for (const name of ['from', 'innerJoin', 'leftJoin', 'where', 'groupBy']) {
    node[name] = () => node;
  }
  node.then = (resolve: (value: unknown) => unknown, reject: (e: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject);
  return node;
};

type Fixture = {
  tickets: unknown[];
  lastPayments?: unknown[];
  services?: unknown[];
  inProgress?: { count: number; total: number };
  payments?: unknown[];
};

/** Each query is told apart by the columns it selects, not by call order. */
const useFixture = (fixture: Fixture) => {
  mockSelect.mockImplementation((fields: Record<string, unknown>) => {
    if ('folio_number' in fields) return chain(fixture.tickets);
    if ('last_payment_at' in fields) return chain(fixture.lastPayments ?? []);
    if ('summary' in fields) return chain(fixture.services ?? []);
    if ('count' in fields) return chain([fixture.inProgress ?? { count: 0, total: 0 }]);
    if ('amount' in fields) return chain(fixture.payments ?? []);
    throw new Error(`unexpected select ${Object.keys(fields).join(',')}`);
  });
};

const ticketRow = (id: number, overrides: Record<string, unknown> = {}) => ({
  id: BigInt(id),
  client_name: `Cliente ${id}`,
  client_tel: '5551234567',
  ticket_date: new Date('2026-01-01T18:00:00Z'),
  created_at: new Date('2026-01-01T18:00:00Z'),
  total: 100,
  paid: 0,
  finished: true,
  company_id: 7,
  document_kind: 'ticket',
  client_id: null,
  folio_number: id,
  folio_prefix: 'R',
  ...overrides,
});

// 2026-02-01 03:00 UTC is still 31 January in Mexico City.
const NOW = new Date('2026-02-01T03:00:00Z');

/**
 * The ClimaTotal Demo shape: Museo de Arte Contemporáneo owes R-0016 and
 * R-0036, Ana owes one old ticket, and two tickets are still En proceso.
 */
const demo: Fixture = {
  tickets: [
    ticketRow(16, {
      client_id: 12,
      client_name: 'Museo de Arte Contemporáneo',
      total: 1210,
      ticket_date: new Date('2026-01-02T18:00:00Z'),
    }),
    ticketRow(36, {
      client_id: 12,
      client_name: 'Museo de Arte Contemporáneo',
      total: 2000,
      paid: 400,
      ticket_date: new Date('2026-01-20T18:00:00Z'),
    }),
    ticketRow(5, {
      client_id: 13,
      client_name: 'Ana',
      total: 5000,
      ticket_date: new Date('2025-09-01T18:00:00Z'),
    }),
  ],
  lastPayments: [{ ticket_id: BigInt(36), last_payment_at: new Date('2026-01-25T18:00:00Z') }],
  services: [{ ticket_id: BigInt(16), summary: 'Compresor, Mano de obra' }],
  inProgress: { count: 2, total: 2958780 },
  payments: [
    { amount: 400, created_at: new Date('2026-01-25T18:00:00Z') },
    // 1 Feb 02:00 UTC is still January in Mexico City.
    { amount: 250.5, created_at: new Date('2026-02-01T02:00:00Z') },
    // December: out of the month.
    { amount: 999, created_at: new Date('2025-12-31T18:00:00Z') },
  ],
};

describe('getCobranzaList', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireTicketRead.mockResolvedValue({ companyId: 7 });
  });

  it('scopes to the effective company and orders by days since the work', async () => {
    useFixture({
      tickets: [
        ticketRow(1, { ticket_date: new Date('2026-01-01T18:00:00Z') }),
        ticketRow(2, { ticket_date: new Date('2025-12-01T18:00:00Z'), paid: 40 }),
        ticketRow(3, { ticket_date: new Date('2026-01-05T18:00:00Z') }),
      ],
      // A recent payment no longer moves a ticket down the queue (ZIG-I31).
      lastPayments: [{ ticket_id: BigInt(2), last_payment_at: new Date() }],
      services: [{ ticket_id: BigInt(1), summary: 'Compresor, Mano de obra' }],
    });

    const result = await getCobranzaList(99);

    expect(mockRequireTicketRead).toHaveBeenCalledWith(99);
    expect(result.success).toBe(true);
    expect(result.data?.rows.map((r) => r.id)).toEqual(['2', '1', '3']);
    expect(result.data?.rows[1].services_summary).toBe('Compresor, Mano de obra');
    expect(result.data?.rows[0].folio).toBe('R-0002');
  });

  it('skips the payment and service queries when nothing is owed', async () => {
    useFixture({ tickets: [] });
    const result = await getCobranzaList(7);
    expect(result.data).toEqual({ rows: [], summary: { count: 0, balanceSum: 0 } });
    expect(mockSelect).toHaveBeenCalledTimes(1);
  });
});

describe('getCobranzaPaginated', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers({ now: NOW, doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
    mockRequireTicketRead.mockResolvedValue({ companyId: 7 });
    useFixture(demo);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('returns the buckets, whose sums add up to the total por cobrar', async () => {
    const result = await getCobranzaPaginated({ companyId: 99 });
    expect(mockRequireTicketRead).toHaveBeenCalledWith(99);
    const data = result.data!;

    expect(data.buckets['0-30']).toEqual({ count: 2, amount: 2810 });
    expect(data.buckets['31-90']).toEqual({ count: 0, amount: 0 });
    expect(data.buckets['90+']).toEqual({ count: 1, amount: 5000 });
    expect(data.buckets.all).toEqual({ count: 3, amount: 7810 });
    expect(
      data.buckets['0-30'].amount + data.buckets['31-90'].amount + data.buckets['90+'].amount,
    ).toBe(data.buckets.all.amount);
    expect(data.buckets.clients).toBe(2);
    expect(data.totalBalance).toBe(7810);
    expect(data.total).toBe(3);
    // Oldest work first: Ana (152 d), R-0016 (29 d), R-0036 (11 d).
    expect(data.rows.map((r) => r.folio)).toEqual(['R-0005', 'R-0016', 'R-0036']);
    expect(data.rows[2].daysSinceLastPayment).toBe(6);
    expect(data.groups).toEqual([]);
  });

  it('reports En proceso and the payments of the company month', async () => {
    const { data } = await getCobranzaPaginated({});
    expect(data!.inProgress).toEqual({ count: 2, total: 2958780 });
    expect(data!.collectedThisMonth).toEqual({ amount: 650.5, payments: 2 });
  });

  it('filters by bucket without changing the strip', async () => {
    const { data } = await getCobranzaPaginated({ bucket: '90+' });
    expect(data!.rows.map((r) => r.folio)).toEqual(['R-0005']);
    expect(data!.total).toBe(1);
    expect(data!.totalBalance).toBe(5000);
    expect(data!.buckets.all.amount).toBe(7810);
  });

  it('applies search and status to the strip too', async () => {
    const { data } = await getCobranzaPaginated({ search: 'museo', status: 'partial' });
    expect(data!.rows.map((r) => r.folio)).toEqual(['R-0036']);
    expect(data!.buckets.all).toEqual({ count: 1, amount: 1600 });
  });

  it('groups Museo de Arte Contemporáneo into one row with $2,810.00', async () => {
    const { data } = await getCobranzaPaginated({ groupBy: 'client' });
    expect(data!.rows).toEqual([]);
    expect(data!.total).toBe(2);
    const museo = data!.groups.find((g) => g.client_id === 12)!;
    expect(museo.balanceDue).toBe(2810);
    expect(museo.tickets.map((t) => t.folio)).toEqual(['R-0016', 'R-0036']);
    expect(museo.oldestDays).toBe(29);
    expect(data!.groups.map((g) => g.client_name)).toEqual([
      'Ana',
      'Museo de Arte Contemporáneo',
    ]);
  });

  it('paginates and clamps the page', async () => {
    const first = await getCobranzaPaginated({ pageSize: 2 });
    expect(first.data!.rows).toHaveLength(2);
    expect(first.data!.totalPages).toBe(2);
    const past = await getCobranzaPaginated({ pageSize: 2, page: 9 });
    expect(past.data!.page).toBe(2);
    expect(past.data!.rows.map((r) => r.folio)).toEqual(['R-0036']);
  });

  it('sorts by saldo and by most recent', async () => {
    const balance = await getCobranzaPaginated({ sort: 'balance' });
    expect(balance.data!.rows.map((r) => r.folio)).toEqual(['R-0005', 'R-0036', 'R-0016']);
    const recent = await getCobranzaPaginated({ sort: 'recent' });
    expect(recent.data!.rows.map((r) => r.folio)).toEqual(['R-0036', 'R-0016', 'R-0005']);
  });

  it('returns the coded error when the read is refused', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    mockRequireTicketRead.mockRejectedValue(new Error('forbidden'));
    const result = await getCobranzaPaginated({});
    expect(result.success).toBe(false);
  });
});
