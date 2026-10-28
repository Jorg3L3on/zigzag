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
const chain = (rows: unknown[], wheres: SQL[], orders: SQL[][] = []) => {
  const terminal: Record<string, unknown> = {};
  terminal.orderBy = jest.fn((...order: SQL[]) => {
    orders.push(order);
    return terminal;
  });
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
    const orders: SQL[][] = [];
    const selects: unknown[] = [];
    const responses = [
      chain([{ total: 3 }], wheres), // filtered page count
      chain(
        [{ allCount: 4, dueCount: 2, phoneDueCount: 3, inProgressCount: 1, paidCount: 1 }],
        wheres,
      ), // one aggregate for the four tabs
      chain([{ id: 1n }], wheres, orders), // page
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
    return { result, wheres, selects, orders };
  };

  it('returns the count, the four tab counts and the phone chip count apart (ZIG-I28-4)', async () => {
    const { result } = await run({ companyId: 10, statusFilter: 'due' });

    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({
      total: 3,
      dueCount: 3,
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

  it('counts Por cobrar on finished work only, and the phone chip under ?finished (PR #610 review)', async () => {
    const { selects } = await run({ companyId: 10, finishedFilter: 'no' });
    const fields = selects[1] as { dueCount: SQL; phoneDueCount: SQL };

    // Desktop tab: finished = true and a saldo, never En proceso (26 vs 17 before).
    const due = sqlOf(fields.dueCount);
    expect(due.sql).toMatch(/"finished" = \$\d+/);
    expect(due.params).toContain(true);
    expect(due.sql).toContain('< COALESCE("Ticket"."total", 0) - 0.01');

    // Phone chip: a saldo under the ?finished=no filter, as in sandbox (9, not 26).
    const phone = sqlOf(fields.phoneDueCount);
    expect(phone.sql).toMatch(/"finished" = \$\d+/);
    expect(phone.params).toContain(false);
    expect(phone.sql).toContain('< COALESCE("Ticket"."total", 0) - 0.01');
  });

  it('leaves the phone chip unfiltered by finished when the filter is all', async () => {
    const { selects } = await run({ companyId: 10 });
    const phone = sqlOf((selects[1] as { phoneDueCount: SQL }).phoneDueCount);
    expect(phone.sql).not.toMatch(/"finished"/);
  });

  describe('sort over the whole list (ZIG-I33-2)', () => {
    const orderSql = (order: SQL[]) =>
      order.map((part) => sqlOf(part).sql.replace(/\s+/g, ' ').toLowerCase());

    it('keeps the newest created first without a sort', async () => {
      const { orders } = await run({ companyId: 10 });
      expect(orderSql(orders[0])).toEqual(['"ticket"."created_at" desc']);
    });

    it('sorts by the chosen column, then the newest created and the id so pages never shuffle', async () => {
      const { orders } = await run({ companyId: 10, sort: { column: 'total', direction: 'desc' } });
      expect(orderSql(orders[0])).toEqual([
        '"ticket"."total" desc nulls last',
        '"ticket"."created_at" desc',
        '"ticket"."id" desc',
      ]);
    });

    it('sorts Saldo and Estado by the rules the list shows', async () => {
      const saldo = await run({ companyId: 10, sort: { column: 'saldo', direction: 'asc' } });
      const [balance] = orderSql(saldo.orders[0]);
      expect(balance).toContain('case when coalesce("ticket"."total", 0) - coalesce("ticket"."paid", 0) > 0.01');
      expect(balance).toMatch(/ asc nulls last$/);

      const estado = await run({ companyId: 10, sort: { column: 'estado', direction: 'desc' } });
      const [rank] = orderSql(estado.orders[0]);
      expect(rank).toMatch(/^case when .* then 0 when .* then 1 else 2 end desc nulls last$/);
    });

    it('sorts Cliente case-insensitively and Fecha by the ticket date', async () => {
      const cliente = await run({ companyId: 10, sort: { column: 'cliente', direction: 'asc' } });
      expect(orderSql(cliente.orders[0])[0]).toBe('lower("ticket"."client_name") asc nulls last');
      const fecha = await run({ companyId: 10, sort: { column: 'fecha', direction: 'desc' } });
      expect(orderSql(fecha.orders[0])[0]).toBe('"ticket"."ticket_date" desc nulls last');
    });

    it('never puts caller text in ORDER BY: unknown columns keep the default order', async () => {
      const { orders } = await run({
        companyId: 10,
        sort: { column: 'id; drop table "Ticket"' as never, direction: 'asc' },
      });
      expect(orderSql(orders[0])).toEqual(['"ticket"."created_at" desc']);

      const odd = await run({
        companyId: 10,
        sort: { column: 'total', direction: 'sideways' as never },
      });
      expect(orderSql(odd.orders[0])[0]).toBe('"ticket"."total" desc nulls last');
      for (const part of [...orders[0], ...odd.orders[0]]) {
        expect(sqlOf(part).params).toEqual([]);
      }
    });
  });
});
