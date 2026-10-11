/**
 * @jest-environment node
 *
 * The real actions against a migrated Postgres, in a company created for the
 * test: first presupuesto P-0001, converting it gives the ticket R-0001 while
 * the recibo keeps showing P-0001, the next ticket is R-0002.
 *   FOLIO_DB_TEST=1 DATABASE_URL=... npx jest src/actions/folio-flow.db.test.ts
 */
import { eq, inArray } from 'drizzle-orm';
import {
  client,
  company,
  documentFolioCounter,
  servicesTickets,
  ticket,
  user,
} from '@/db/schema';

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

import { convertPresupuestoToTicket, createPresupuestoWithLines } from '@/actions/presupuestos';
import { createTicketWithLines } from '@/actions/tickets';
import { db } from '@/lib/db';
import { formatDisplayFolio } from '@/lib/folio';

const enabled = process.env.FOLIO_DB_TEST === '1';
const describeDb = enabled ? describe : describe.skip;

describeDb('folio flow in a fresh company (real actions, real Postgres)', () => {
  let companyId = 0;
  let clientId = 0;
  const lines = [{ kind: 'custom' as const, name: 'Revisión', quantity: 1, price: 500 }];

  beforeAll(async () => {
    const [row] = await db
      .insert(company)
      .values({
        name: `Folio flow ${Date.now()}`,
        phone: '5550000000',
        email: `folio-flow-${Date.now()}@test.local`,
        street: 'x',
        exterior_number: '1',
        neighborhood: 'x',
        city: 'x',
        state: 'x',
        country: 'MX',
        postal_code: '00000',
      })
      .returning({ id: company.id });
    companyId = row.id;
    const [clientRow] = await db
      .insert(client)
      .values({ company_id: companyId, name: 'Cliente flujo', phone: '5551112222' })
      .returning({ id: client.id });
    clientId = clientRow.id;
    const [anyUser] = await db.select({ id: user.id }).from(user).limit(1);
    mockContext.current = { userId: String(anyUser.id), companyId, companyIsSystem: false };
  });

  afterAll(async () => {
    const ids = (
      await db.select({ id: ticket.id }).from(ticket).where(eq(ticket.company_id, companyId))
    ).map((r) => r.id);
    if (ids.length > 0) {
      await db.delete(servicesTickets).where(inArray(servicesTickets.ticket_id, ids));
    }
    await db.delete(ticket).where(eq(ticket.company_id, companyId));
    await db.delete(client).where(eq(client.company_id, companyId));
    await db.delete(documentFolioCounter).where(eq(documentFolioCounter.company_id, companyId));
    await db.delete(company).where(eq(company.id, companyId));
  });

  it('numbers presupuestos and tickets from 1 and keeps the P folio on a converted recibo', async () => {
    const base = { company_id: companyId, client_id: clientId, ticket_date: new Date(), lines };

    const first = await createPresupuestoWithLines({ ...base, expires_at: null } as never);
    expect(first).toMatchObject({ success: true });
    expect(first.data?.folio).toBe('P-0001');

    const second = await createPresupuestoWithLines({ ...base, expires_at: null } as never);
    expect(second.data?.folio).toBe('P-0002');

    const converted = await convertPresupuestoToTicket(Number(first.data!.id), companyId);
    expect(converted.success).toBe(true);
    expect(converted.data?.ticketFolio).toBe('R-0001');

    const work = await db.query.ticket.findFirst({
      where: eq(ticket.id, BigInt(converted.data!.ticketId)),
    });
    const source = await db.query.ticket.findFirst({
      where: eq(ticket.id, BigInt(first.data!.id)),
      columns: { folio_number: true, folio_prefix: true },
    });
    expect(formatDisplayFolio({ ...work!, source_presupuesto_folio: source })).toBe('P-0001');

    const plain = await createTicketWithLines({ ...base } as never);
    expect(plain.data?.folio).toBe('R-0002');
  });
});
