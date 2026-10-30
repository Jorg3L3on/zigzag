/**
 * @jest-environment node
 *
 * ZIG-I35-1: composer creates with a client_request_id, against a migrated
 * Postgres in companies created for the test. The audit writer is real because
 * the key lives in the `created` audit payload.
 *   CLIENT_REQUEST_DB_TEST=1 DATABASE_URL=... npx jest src/actions/client-request.db.test.ts
 */
import { randomUUID } from 'node:crypto';
import { eq, inArray } from 'drizzle-orm';
import {
  auditEvent,
  client,
  company,
  documentFolioCounter,
  service,
  servicesTickets,
  ticket,
  ticketAuditEvent,
  ticketLineMaterial,
  ticketPayment,
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
jest.mock('@/lib/cache', () => ({ invalidateCompanyCache: jest.fn() }));
jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }));
jest.mock('@/lib/company-production-guard', () => ({
  assertCompanyProductionReady: jest.fn(),
  CompanyProductionBlockedError: class CompanyProductionBlockedError extends Error {},
}));

import { createPresupuestoWithLines } from '@/actions/presupuestos';
import { createTicketWithLines } from '@/actions/tickets';
import { db } from '@/lib/db';

const enabled = process.env.CLIENT_REQUEST_DB_TEST === '1';
const describeDb = enabled ? describe : describe.skip;

type Fixture = { companyId: number; clientId: number; serviceId: number };

const createCompany = async (label: string): Promise<Fixture> => {
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const [row] = await db
    .insert(company)
    .values({
      name: `Client request ${label} ${stamp}`,
      phone: '5550000000',
      email: `client-request-${label}-${stamp}@test.local`,
      street: 'x',
      exterior_number: '1',
      neighborhood: 'x',
      city: 'x',
      state: 'x',
      country: 'MX',
      postal_code: '00000',
    })
    .returning({ id: company.id });
  const [clientRow] = await db
    .insert(client)
    .values({ company_id: row.id, name: 'Cliente de prueba', phone: '5551112222' })
    .returning({ id: client.id });
  const [serviceRow] = await db
    .insert(service)
    .values({ company_id: row.id, name: 'Revisión', description: 'Prueba', price: 500 })
    .returning({ id: service.id });
  return { companyId: row.id, clientId: clientRow.id, serviceId: serviceRow.id };
};

const removeCompany = async (companyId: number) => {
  const ids = (
    await db.select({ id: ticket.id }).from(ticket).where(eq(ticket.company_id, companyId))
  ).map((r) => r.id);
  if (ids.length > 0) {
    const lineIds = (
      await db
        .select({ id: servicesTickets.id })
        .from(servicesTickets)
        .where(inArray(servicesTickets.ticket_id, ids))
    ).map((r) => r.id);
    if (lineIds.length > 0) {
      await db
        .delete(ticketLineMaterial)
        .where(inArray(ticketLineMaterial.services_tickets_id, lineIds));
    }
    await db.delete(servicesTickets).where(inArray(servicesTickets.ticket_id, ids));
    await db.delete(ticketPayment).where(inArray(ticketPayment.ticket_id, ids));
  }
  await db.delete(ticketAuditEvent).where(eq(ticketAuditEvent.company_id, companyId));
  await db.delete(auditEvent).where(eq(auditEvent.target_company_id, companyId));
  await db.delete(ticket).where(eq(ticket.company_id, companyId));
  await db.delete(service).where(eq(service.company_id, companyId));
  await db.delete(client).where(eq(client.company_id, companyId));
  await db.delete(documentFolioCounter).where(eq(documentFolioCounter.company_id, companyId));
  await db.delete(company).where(eq(company.id, companyId));
};

const countDocuments = async (companyId: number) =>
  (await db.select({ id: ticket.id }).from(ticket).where(eq(ticket.company_id, companyId)))
    .length;

describeDb('composer client_request_id (real actions, real Postgres)', () => {
  let a: Fixture;
  let b: Fixture;
  let userIds: string[] = [];

  const as = (userId: string, companyId: number) => {
    mockContext.current = { userId, companyId, companyIsSystem: false };
  };

  const ticketInput = (fixture: Fixture, key?: string) => ({
    company_id: fixture.companyId,
    client_id: fixture.clientId,
    ticket_date: new Date(),
    lines: [
      {
        service_id: fixture.serviceId,
        quantity: 2,
        price: 500,
        materials: [{ kind: 'custom' as const, name: 'Gas R-410', quantity: 1, unit: 'kg', price: 300 }],
      },
      { kind: 'custom' as const, name: 'Traslado', quantity: 1, price: 150 },
    ],
    ...(key ? { client_request_id: key } : {}),
  });

  beforeAll(async () => {
    a = await createCompany('a');
    b = await createCompany('b');
    userIds = (await db.select({ id: user.id }).from(user).limit(2)).map((row) => String(row.id));
    expect(userIds.length).toBe(2);
  });

  afterAll(async () => {
    await removeCompany(a.companyId);
    await removeCompany(b.companyId);
  });

  it('two calls with the same key return the same document and folio and write one row', async () => {
    as(userIds[0], a.companyId);
    const key = randomUUID();
    const before = await countDocuments(a.companyId);

    const first = await createTicketWithLines(ticketInput(a, key) as never);
    expect(first).toMatchObject({ success: true, data: { replayed: false } });
    const again = await createTicketWithLines(ticketInput(a, key) as never);
    expect(again).toMatchObject({ success: true, data: { replayed: true } });
    expect(again.data?.id).toBe(first.data?.id);
    expect(again.data?.folio).toBe(first.data?.folio);
    expect(first.data?.total).toBe(1450);
    expect(await countDocuments(a.companyId)).toBe(before + 1);

    // Two concurrent saves with a fresh key still make one document.
    const raced = randomUUID();
    const [x, y] = await Promise.all([
      createTicketWithLines(ticketInput(a, raced) as never),
      createTicketWithLines(ticketInput(a, raced) as never),
    ]);
    expect(x.data?.id).toBe(y.data?.id);
    expect(await countDocuments(a.companyId)).toBe(before + 2);
  });

  it('the same key from another company or another user creates its own document', async () => {
    const key = randomUUID();
    as(userIds[0], a.companyId);
    const mine = await createTicketWithLines(ticketInput(a, key) as never);
    as(userIds[1], a.companyId);
    const otherUser = await createTicketWithLines(ticketInput(a, key) as never);
    as(userIds[0], b.companyId);
    const otherCompany = await createTicketWithLines(ticketInput(b, key) as never);

    expect(otherUser.data?.replayed).toBe(false);
    expect(otherCompany.data?.replayed).toBe(false);
    expect(new Set([mine.data?.id, otherUser.data?.id, otherCompany.data?.id]).size).toBe(3);
  });

  it('without a key every call creates a document, as before', async () => {
    as(userIds[0], a.companyId);
    const before = await countDocuments(a.companyId);
    const one = await createTicketWithLines(ticketInput(a) as never);
    const two = await createTicketWithLines(ticketInput(a) as never);
    expect(one.data?.id).not.toBe(two.data?.id);
    expect(await countDocuments(a.companyId)).toBe(before + 2);
  });

  it('a replay after the service was deleted still returns the saved document', async () => {
    as(userIds[0], b.companyId);
    const [extra] = await db
      .insert(service)
      .values({ company_id: b.companyId, name: 'Temporal', description: 'x', price: 100 })
      .returning({ id: service.id });
    const fixture = { ...b, serviceId: extra.id };
    const key = randomUUID();
    const first = await createTicketWithLines(ticketInput(fixture, key) as never);
    expect(first.success).toBe(true);

    await db.update(service).set({ deleted_at: new Date() }).where(eq(service.id, extra.id));
    const replay = await createTicketWithLines(ticketInput(fixture, key) as never);
    expect(replay).toMatchObject({ success: true, data: { id: first.data?.id, replayed: true } });

    // A new key with the deleted service is rejected, so the outbox can show Revisar.
    const fresh = await createTicketWithLines(ticketInput(fixture, randomUUID()) as never);
    expect(fresh.success).toBe(false);
  });

  it('finish creates and finishes in one write, and a replay keeps it finished once', async () => {
    as(userIds[0], a.companyId);
    const key = randomUUID();
    const input = { ...ticketInput(a, key), finish: { parcial: 400 } };
    const first = await createTicketWithLines(input as never);
    expect(first).toMatchObject({ success: true, data: { finished: true } });
    const row = await db.query.ticket.findFirst({ where: eq(ticket.id, BigInt(first.data!.id)) });
    expect(row).toMatchObject({ finished: true, paid: 400 });

    const replay = await createTicketWithLines(input as never);
    expect(replay.data).toMatchObject({ id: first.data?.id, replayed: true, finished: true });

    const tooMuch = await createTicketWithLines({
      ...ticketInput(a, randomUUID()),
      finish: { parcial: 99999 },
    } as never);
    expect(tooMuch.success).toBe(false);
  });

  it('presupuestos replay the same way', async () => {
    as(userIds[0], a.companyId);
    const key = randomUUID();
    const input = { ...ticketInput(a, key), expires_at: null };
    const first = await createPresupuestoWithLines(input as never);
    const again = await createPresupuestoWithLines(input as never);
    expect(first.data?.folio).toMatch(/^P-/);
    expect(again.data).toMatchObject({ id: first.data?.id, folio: first.data?.folio, replayed: true });
  });
});
