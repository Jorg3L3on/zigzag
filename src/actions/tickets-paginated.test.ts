import { PgDialect } from 'drizzle-orm/pg-core';
import type { SQL } from 'drizzle-orm';

import { getTicketsPaginated } from '@/actions/tickets';
import { db } from '@/lib/db';
import { requireTicketRead } from '@/lib/tickets-rbac-server';

jest.mock('@/lib/db', () => ({ db: { select: jest.fn() } }));
jest.mock('@/lib/tickets-rbac-server', () => ({
  requireTicketRead: jest.fn(),
  requireTicketWrite: jest.fn(),
}));
jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }));

const mockSelect = db.select as unknown as jest.Mock;

/** One chain per db.select(): from → where → (orderBy → limit → offset) resolves to `rows`. */
const chain = (rows: unknown[], wheres: SQL[]) => {
  const terminal: Record<string, unknown> = {};
  terminal.orderBy = jest.fn(() => terminal);
  terminal.limit = jest.fn(() => terminal);
  terminal.offset = jest.fn(async () => rows);
  const afterWhere = Object.assign(Promise.resolve(rows), terminal);
  return {
    from: jest.fn(() => ({
      where: jest.fn((where: SQL) => {
        wheres.push(where);
        return afterWhere;
      }),
    })),
  };
};

/** Services summary: from → innerJoin → leftJoin → where → groupBy resolves to `rows`. */
const summaryChain = (rows: unknown[], wheres: SQL[]) => {
  const q: Record<string, unknown> = {};
  q.innerJoin = jest.fn(() => q);
  q.leftJoin = jest.fn(() => q);
  q.where = jest.fn((where: SQL) => {
    wheres.push(where);
    return q;
  });
  q.groupBy = jest.fn(async () => rows);
  return { from: jest.fn(() => q) };
};

const sqlOf = (where: SQL) => new PgDialect().sqlToQuery(where);

describe('getTicketsPaginated summary (ZIG-I13-7)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (requireTicketRead as jest.Mock).mockResolvedValue({ context: {}, companyId: 10 });
  });

  const run = async (params: Parameters<typeof getTicketsPaginated>[0]) => {
    const wheres: SQL[] = [];
    const selects: unknown[] = [];
    const responses = [
      chain([{ total: 3 }], wheres), // filtered page count
      chain(
        [{ allCount: 4, dueCount: 2, inProgressCount: 1, paidCount: 1 }],
        wheres,
      ), // one aggregate for the four tabs
      chain([{ id: 1n }], wheres), // page
      summaryChain([{ ticket_id: 1n, summary: 'Compresor, Mano de obra' }], wheres),
    ];
    mockSelect.mockImplementation((fields?: unknown) => {
      selects.push(fields ?? null);
      const next = responses.shift();
      if (!next) {
        throw new Error('unexpected select');
      }
      return next;
    });
    const result = await getTicketsPaginated(params);
    return { result, wheres, selects };
  };

  it('returns the count and the four tab counts, with dueCount as an alias (ZIG-I28-4)', async () => {
    const { result } = await run({ companyId: 10, statusFilter: 'due' });

    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({
      total: 3,
      dueCount: 2,
      counts: { all: 4, due: 2, inProgress: 1, paid: 1 },
    });
    expect(result.data).not.toHaveProperty('balanceDue');
  });

  it('attaches the work summary of each ticket with one company-scoped aggregate (ZIG-I18-8)', async () => {
    const { result, wheres } = await run({ companyId: 10 });

    expect(result.data?.items[0]).toMatchObject({ id: 1n, services_summary: 'Compresor, Mano de obra' });
    expect(mockSelect).toHaveBeenCalledTimes(4);
    const { sql: text, params } = sqlOf(wheres[3]);
    expect(text).toContain('"company_id"');
    expect(params).toContain(10);
  });

  it('the due filter means a saldo above a cent, parcial or sin pagos', async () => {
    const { wheres } = await run({ companyId: 10, statusFilter: 'due' });

    const list = sqlOf(wheres[0]);
    expect(list.sql).toContain('COALESCE("Ticket"."total", 0) > 0.01');
    expect(list.sql).toContain('COALESCE("Ticket"."paid", 0) < COALESCE("Ticket"."total", 0) - 0.01');
  });

  it('is tenant-scoped on every query and the tab counts ignore the status chip', async () => {
    const { wheres, selects } = await run({
      companyId: 10,
      statusFilter: 'paid',
      search: 'torres',
    });

    for (const where of wheres) {
      const query = sqlOf(where);
      expect(query.sql).toContain('"company_id" = $');
      expect(query.sql).toContain('"deleted_at" is null');
      expect(query.sql).toContain('"document_kind" = $');
      expect(query.params).toEqual(expect.arrayContaining([10, 'ticket']));
    }
    // 0: list count (paid chip on). 1: tab counts (search kept, status chip not in the WHERE).
    const tabScope = sqlOf(wheres[1]);
    expect(tabScope.params).toEqual(expect.arrayContaining(['%torres%']));
    expect(tabScope.sql).not.toContain('>= COALESCE("Ticket"."total", 0) - 0.01');
    expect(sqlOf(wheres[0]).sql).toContain('>= COALESCE("Ticket"."total", 0) - 0.01');

    const fields = selects[1] as { dueCount: SQL; paidCount: SQL; inProgressCount: SQL };
    const due = sqlOf(fields.dueCount);
    expect(due.sql.toLowerCase()).toContain('filter');
    expect(due.sql).toContain('< COALESCE("Ticket"."total", 0) - 0.01');
    expect(sqlOf(fields.paidCount).sql).toContain('>= COALESCE("Ticket"."total", 0) - 0.01');
    expect(sqlOf(fields.inProgressCount).sql.toLowerCase()).toContain('finished');
  });

  it('counts the four tabs under search and dates only, not the finished view', async () => {
    const { wheres } = await run({
      companyId: 10,
      statusFilter: 'due',
      finishedFilter: 'no',
      search: 'torres',
      dateFrom: '2026-01-01T00:00:00.000Z',
      dateTo: '2026-01-31T23:59:59.000Z',
    });

    const tabScope = sqlOf(wheres[1]);
    expect(tabScope.params).toEqual(
      expect.arrayContaining(['%torres%', '2026-01-01T00:00:00.000Z', '2026-01-31T23:59:59.000Z']),
    );
    expect(tabScope.sql).not.toMatch(/"finished"/);
    const list = sqlOf(wheres[0]);
    expect(list.sql).toMatch(/"finished"/);
    expect(list.sql).toContain('< COALESCE("Ticket"."total", 0) - 0.01');
  });
});
