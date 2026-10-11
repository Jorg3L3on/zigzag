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

const sqlOf = (where: SQL) => new PgDialect().sqlToQuery(where);

describe('getTicketsPaginated summary (ZIG-I13-7)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (requireTicketRead as jest.Mock).mockResolvedValue({ context: {}, companyId: 10 });
  });

  const run = async (params: Parameters<typeof getTicketsPaginated>[0]) => {
    const wheres: SQL[] = [];
    mockSelect
      .mockReturnValueOnce(chain([{ total: 3, balanceDue: '843164.79' }], wheres)) // count + saldo
      .mockReturnValueOnce(chain([{ dueCount: 2 }], wheres)) // por cobrar count
      .mockReturnValueOnce(chain([{ id: 1n }], wheres)); // page
    const result = await getTicketsPaginated(params);
    return { result, wheres };
  };

  it('returns the saldo of every ticket matching the filters and the Por cobrar count', async () => {
    const { result } = await run({ companyId: 10, statusFilter: 'due' });

    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({ total: 3, balanceDue: 843164.79, dueCount: 2 });
  });

  it('the due filter means a saldo above a cent, parcial or sin pagos', async () => {
    const { wheres } = await run({ companyId: 10, statusFilter: 'due' });

    const list = sqlOf(wheres[0]);
    expect(list.sql).toContain('COALESCE("Ticket"."total", 0) > 0.01');
    expect(list.sql).toContain('COALESCE("Ticket"."paid", 0) < COALESCE("Ticket"."total", 0) - 0.01');
  });

  it('is tenant-scoped on every query and the Por cobrar count ignores the status chip', async () => {
    const { wheres } = await run({ companyId: 10, statusFilter: 'paid', search: 'torres' });

    for (const where of wheres) {
      const query = sqlOf(where);
      expect(query.sql).toContain('"company_id" = $');
      expect(query.sql).toContain('"deleted_at" is null');
      expect(query.sql).toContain('"document_kind" = $');
      expect(query.params).toEqual(expect.arrayContaining([10, 'ticket']));
    }
    // 0: list + saldo (paid chip on), 1: due count (search kept, status chip replaced by "due").
    const dueCount = sqlOf(wheres[1]);
    expect(dueCount.params).toEqual(expect.arrayContaining(['%torres%']));
    expect(dueCount.sql).toContain('< COALESCE("Ticket"."total", 0) - 0.01');
    expect(sqlOf(wheres[0]).sql).toContain('>= COALESCE("Ticket"."total", 0) - 0.01');
  });

  it('rounds the saldo to cents', async () => {
    const wheres: SQL[] = [];
    mockSelect
      .mockReturnValueOnce(chain([{ total: 1, balanceDue: '100.004999' }], wheres))
      .mockReturnValueOnce(chain([{ dueCount: 1 }], wheres))
      .mockReturnValueOnce(chain([], wheres));

    const result = await getTicketsPaginated({ companyId: 10 });

    expect(result.data?.balanceDue).toBe(100);
  });
});
