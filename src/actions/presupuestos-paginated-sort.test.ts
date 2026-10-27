import { PgDialect } from 'drizzle-orm/pg-core';
import type { SQL } from 'drizzle-orm';

import { getPresupuestosPaginated } from '@/actions/presupuestos';
import { db } from '@/lib/db';
import { requireTicketRead } from '@/lib/tickets-rbac-server';

jest.mock('@/lib/db', () => ({ db: { select: jest.fn() } }));
jest.mock('@/lib/tickets-rbac-server', () => ({
  requireTicketRead: jest.fn(),
  requireTicketWrite: jest.fn(),
}));
jest.mock('@/lib/folio-allocator', () => ({ allocateDocumentFolio: jest.fn() }));
jest.mock('@/lib/ticket-audit', () => ({ recordTicketAudit: jest.fn() }));
jest.mock('@/lib/cache', () => ({ invalidateCompanyCache: jest.fn() }));
jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }));

const mockSelect = db.select as unknown as jest.Mock;
const sqlOf = (part: SQL) => new PgDialect().sqlToQuery(part);

/**
 * The page query's ORDER BY (ZIG-I33-2). Two selects run with an empty page: the
 * counts (from → where) and the page (from → where → orderBy → limit → offset).
 */
const orderFor = async (sort: Parameters<typeof getPresupuestosPaginated>[0]['sort']) => {
  const orders: SQL[][] = [];
  const counts = { all: 0, abierto: 0, vencido: 0, convertido: 0, cancelado: 0, venceHoy: 0 };
  const page: Record<string, unknown> = {};
  page.orderBy = jest.fn((...order: SQL[]) => {
    orders.push(order);
    return page;
  });
  page.limit = jest.fn(() => page);
  page.offset = jest.fn(async () => []);
  mockSelect
    .mockReturnValueOnce({ from: () => ({ where: async () => [counts] }) })
    .mockReturnValueOnce({ from: () => ({ where: () => page }) });

  const result = await getPresupuestosPaginated({ companyId: 4, sort });
  expect(result.success).toBe(true);
  return orders[0].map((part) => {
    const query = sqlOf(part);
    expect(query.params).toEqual([]);
    return query.sql.replace(/\s+/g, ' ').toLowerCase();
  });
};

describe('getPresupuestosPaginated sort (ZIG-I33-2)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (requireTicketRead as jest.Mock).mockResolvedValue({ context: {}, companyId: 4 });
  });

  const VENCEN_PRIMERO = [
    '"ticket"."expires_at" asc nulls last',
    '"ticket"."ticket_date" desc nulls last',
    '"ticket"."id" desc',
  ];

  it('keeps Vencen primero without a sort', async () => {
    expect(await orderFor(undefined)).toEqual(VENCEN_PRIMERO);
  });

  it('reads the old presets as the same column sorts', async () => {
    expect(await orderFor('vence')).toEqual(VENCEN_PRIMERO);
    expect(await orderFor('recientes')).toEqual([
      '"ticket"."ticket_date" desc nulls last',
      '"ticket"."id" desc',
    ]);
    expect(await orderFor('total')).toEqual(['"ticket"."total" desc nulls last', '"ticket"."id" desc']);
  });

  it('sorts by a header column, the id last so pages never shuffle', async () => {
    expect(await orderFor({ column: 'cliente', direction: 'asc' })).toEqual([
      'lower("ticket"."client_name") asc nulls last',
      '"ticket"."id" desc',
    ]);
    expect(await orderFor({ column: 'vence', direction: 'desc' })).toEqual([
      '"ticket"."expires_at" desc nulls last',
      '"ticket"."ticket_date" desc nulls last',
      '"ticket"."id" desc',
    ]);
  });

  it('never puts caller text in ORDER BY', async () => {
    expect(await orderFor({ column: 'id; drop table "Ticket"' as never, direction: 'asc' })).toEqual(
      VENCEN_PRIMERO,
    );
    expect(await orderFor('1; select 1' as never)).toEqual(VENCEN_PRIMERO);
    expect(await orderFor({ column: 'total', direction: 'up' as never })).toEqual([
      '"ticket"."total" desc nulls last',
      '"ticket"."id" desc',
    ]);
  });
});
