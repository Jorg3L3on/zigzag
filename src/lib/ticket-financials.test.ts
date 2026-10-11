import { PgDialect } from 'drizzle-orm/pg-core';
import { calculateTicketTotal, syncTicketTotal } from '@/lib/ticket-financials';

describe('ticket financials', () => {
  it('calculates a stable total from quantity and unit price lines', () => {
    const total = calculateTicketTotal([
      { quantity: 2, price: 59.99 },
      { quantity: 1, price: 700 },
      { quantity: 3, price: 12.5 },
    ]);

    expect(total).toBeCloseTo(857.48, 2);
  });

  it('adds each line materials on top of quantity × price (ZIG-I10)', () => {
    expect(
      calculateTicketTotal([
        {
          quantity: 2,
          price: 1000,
          materials: [
            { quantity: 1.5, price: 380 },
            { quantity: 3, price: 0.1 },
          ],
        },
        { quantity: 1, price: 500 },
      ]),
    ).toBe(3070.3);
  });

  it('returns zero when no lines are provided', () => {
    expect(calculateTicketTotal([])).toBe(0);
  });

  it('syncs totals from active service lines only', async () => {
    let whereCondition: unknown;
    let updatedTotal: number | undefined;
    let updatedTicketId: bigint | undefined;

    let materialsWhere: unknown;
    const executor = {
      select: jest.fn(() => ({
        from: jest.fn(() => ({
          where: jest.fn((condition) => {
            whereCondition = condition;
            return Promise.resolve([
              { quantity: 2, price: 50 },
              { quantity: 1, price: 25 },
            ]);
          }),
          innerJoin: jest.fn(() => ({
            where: jest.fn((condition) => {
              materialsWhere = condition;
              // Materials add on top of the lines (ZIG-I10).
              return Promise.resolve([
                { quantity: 2.5, price: 85 },
                { quantity: 1, price: 0.1 },
              ]);
            }),
          })),
        })),
      })),
      update: jest.fn(() => ({
        set: jest.fn((data: { total: number }) => {
          updatedTotal = data.total;
          return {
            where: jest.fn((condition) => {
              const dialect = new PgDialect();
              updatedTicketId = dialect.sqlToQuery(condition).params[0] as bigint;
              return Promise.resolve();
            }),
          };
        }),
      })),
    };

    const total = await syncTicketTotal(executor as never, 42n);

    const dialect = new PgDialect();
    expect(dialect.sqlToQuery(whereCondition as never).sql).toContain(
      '"ServicesTickets"."deleted_at" is null',
    );
    const materialsSql = dialect.sqlToQuery(materialsWhere as never).sql;
    expect(materialsSql).toContain('"ServicesTickets"."deleted_at" is null');
    expect(materialsSql).toContain('"TicketLineMaterial"."deleted_at" is null');
    expect(total).toBe(337.6);
    expect(updatedTotal).toBe(337.6);
    expect(updatedTicketId).toBe(42n);
  });
});
