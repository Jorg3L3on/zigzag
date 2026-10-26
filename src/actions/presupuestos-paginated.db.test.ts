/**
 * @jest-environment node
 *
 * getPresupuestosPaginated against a migrated Postgres, in a company created
 * for the test (ZIG-I29-3): the state computed in SQL matches
 * getPresupuestoStatus for the four states and on both sides of the company
 * day, and the counts follow the search.
 *   PRESUPUESTOS_DB_TEST=1 DATABASE_URL=... npx jest src/actions/presupuestos-paginated.db.test.ts
 */
import { eq } from 'drizzle-orm';
import { company, ticket } from '@/db/schema';

const mockContext = { current: { userId: '0', companyId: 0, companyIsSystem: false } };

jest.mock('@/lib/tickets-rbac-server', () => ({
  requireTicketRead: jest.fn(async () => ({
    context: mockContext.current,
    companyId: mockContext.current.companyId,
  })),
  requireTicketWrite: jest.fn(async () => ({
    context: mockContext.current,
    companyId: mockContext.current.companyId,
  })),
}));

jest.mock('@/lib/ticket-audit', () => ({ recordTicketAudit: jest.fn(async () => undefined) }));
jest.mock('@/lib/cache', () => ({ invalidateCompanyCache: jest.fn() }));
jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }));
jest.mock('@/lib/company-production-guard', () => ({
  assertCompanyProductionReady: jest.fn(),
  CompanyProductionBlockedError: class CompanyProductionBlockedError extends Error {},
}));

import { getPresupuestosPaginated } from '@/actions/presupuestos';
import { db } from '@/lib/db';
import { companyDay } from '@/lib/company-day';
import { getPresupuestoStatus } from '@/lib/ticket-document-kind';

const enabled = process.env.PRESUPUESTOS_DB_TEST === '1';
const describeDb = enabled ? describe : describe.skip;

/** Mexico City midnight of `iso` plus `days`, as the composer stores it (06:00 UTC). */
const companyMidnight = (iso: string, days: number) => {
  const date = new Date(`${iso}T06:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date;
};

describeDb('getPresupuestosPaginated (real Postgres)', () => {
  let companyId = 0;
  let otherCompanyId = 0;
  const today = companyDay(new Date()).iso;

  beforeAll(async () => {
    const base = {
      phone: '5550000000',
      street: 'x',
      exterior_number: '1',
      neighborhood: 'x',
      city: 'x',
      state: 'x',
      country: 'MX',
      postal_code: '00000',
    };
    const [row] = await db
      .insert(company)
      .values({ ...base, name: `Presupuestos list ${Date.now()}`, email: `pl-${Date.now()}@test.local` })
      .returning({ id: company.id });
    const [other] = await db
      .insert(company)
      .values({ ...base, name: `Presupuestos other ${Date.now()}`, email: `po-${Date.now()}@test.local` })
      .returning({ id: company.id });
    companyId = row.id;
    otherCompanyId = other.id;
    mockContext.current = { userId: '0', companyId, companyIsSystem: false };

    const quote = (patch: Partial<typeof ticket.$inferInsert>) => ({
      company_id: companyId,
      document_kind: 'presupuesto',
      client_name: 'Cliente',
      client_tel: '5551112222',
      ticket_date: companyMidnight(today, -10),
      total: 1000,
      finished: false,
      ...patch,
    });
    const [work] = await db
      .insert(ticket)
      .values({ ...quote({}), document_kind: 'ticket', folio_prefix: 'R', folio_number: 1 })
      .returning({ id: ticket.id });
    await db.insert(ticket).values([
      quote({ folio_prefix: 'P', folio_number: 1, client_name: 'Vence hoy', expires_at: companyMidnight(today, 0) }),
      quote({ folio_prefix: 'P', folio_number: 2, client_name: 'Venció ayer', expires_at: companyMidnight(today, -1) }),
      quote({ folio_prefix: 'P', folio_number: 3, client_name: 'Sin fecha', expires_at: null }),
      quote({ folio_prefix: 'P', folio_number: 4, client_name: 'Mañana', expires_at: companyMidnight(today, 1) }),
      quote({ folio_prefix: 'P', folio_number: 5, client_name: 'Aceptado', converted_to_ticket_id: work.id, expires_at: companyMidnight(today, -30) }),
      quote({ folio_prefix: 'P', folio_number: 6, client_name: 'Cancelado', canceled_at: new Date(), expires_at: companyMidnight(today, 5) }),
    ]);
    await db.insert(ticket).values({ ...quote({}), company_id: otherCompanyId, client_name: 'Otra empresa' });
  });

  afterAll(async () => {
    await db.delete(ticket).where(eq(ticket.company_id, companyId));
    await db.delete(ticket).where(eq(ticket.company_id, otherCompanyId));
    await db.delete(company).where(eq(company.id, companyId));
    await db.delete(company).where(eq(company.id, otherCompanyId));
  });

  it('computes the same state as getPresupuestoStatus for every row', async () => {
    const result = await getPresupuestosPaginated({ companyId, view: 'todos', pageSize: 100 });
    expect(result.success).toBe(true);
    const items = result.data!.items;
    expect(items).toHaveLength(6);
    const rows = await db.query.ticket.findMany({ where: eq(ticket.company_id, companyId) });
    for (const item of items) {
      const row = rows.find((r) => String(r.id) === item.id)!;
      expect([item.clientName, item.status]).toEqual([item.clientName, getPresupuestoStatus(row)]);
    }
    const byName = Object.fromEntries(items.map((i) => [i.clientName, i.status]));
    expect(byName).toEqual({
      'Vence hoy': 'abierto',
      'Venció ayer': 'vencido',
      'Sin fecha': 'abierto',
      Mañana: 'abierto',
      Aceptado: 'convertido',
      Cancelado: 'cancelado',
    });
    expect(items.find((i) => i.clientName === 'Aceptado')?.convertedTicketFolio).toBe('R-0001');
    expect(result.data!.counts).toEqual({
      all: 6,
      abierto: 3,
      vencido: 1,
      convertido: 1,
      cancelado: 1,
      venceHoy: 1,
    });
  });

  it('defaults to Abiertos + Vencidos, soonest expiry first, no date last', async () => {
    const result = await getPresupuestosPaginated({ companyId });
    expect(result.data!.items.map((i) => i.clientName)).toEqual([
      'Venció ayer',
      'Vence hoy',
      'Mañana',
      'Sin fecha',
    ]);
    expect(result.data!.total).toBe(4);
  });

  it('counts under the search and finds a folio', async () => {
    const byName = await getPresupuestosPaginated({ companyId, view: 'todos', search: 'venc' });
    expect(byName.data!.counts).toMatchObject({ all: 2, abierto: 1, vencido: 1 });
    const byFolio = await getPresupuestosPaginated({ companyId, view: 'todos', search: 'p4' });
    expect(byFolio.data!.items.map((i) => i.folio)).toEqual(['P-0004']);
  });
});
