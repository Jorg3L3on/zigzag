/**
 * @jest-environment node
 *
 * Integration test on a real Postgres (ZIG-I31-1): Cobranza and Hoy › Saldo
 * por cobrar read the same rule. Runs only when DATABASE_URL points at this
 * machine; see src/lib/mcp/domain/documents.db.test.ts for the setup.
 */
import { inArray } from 'drizzle-orm';
import { client, company, ticket, ticketPayment } from '@/db/schema';
import { db } from '@/lib/db';
import { loadDashboardMetricsForCompany } from '@/lib/dashboard-metrics-loader';
import { getCobranzaPaginated } from '@/actions/cobranza';

const mockRequireTicketRead = jest.fn();
jest.mock('@/lib/tickets-rbac-server', () => ({
  requireTicketRead: (...args: unknown[]) => mockRequireTicketRead(...args),
}));

const LOCAL_DB_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

const hasLocalTestDatabase = (): boolean => {
  try {
    return LOCAL_DB_HOSTS.has(new URL(process.env.DATABASE_URL ?? '').hostname);
  } catch {
    return false;
  }
};

const describeDb = hasLocalTestDatabase() ? describe : describe.skip;

describeDb('Cobranza on a real Postgres', () => {
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  let companyId = 0;
  const ticketIds: bigint[] = [];

  const seedTicket = async (values: Partial<typeof ticket.$inferInsert>) => {
    const [row] = await db
      .insert(ticket)
      .values({
        company_id: companyId,
        document_kind: 'ticket',
        client_tel: '9613151559',
        ticket_date: new Date('2026-01-10T18:00:00Z'),
        created_at: new Date('2026-01-10T18:00:00Z'),
        paid: 0,
        ...values,
      })
      .returning({ id: ticket.id });
    ticketIds.push(row.id);
    return row.id;
  };

  beforeAll(async () => {
    const [row] = await db
      .insert(company)
      .values({
        name: `Cobranza ${stamp}`,
        phone: '5550000000',
        email: `cobranza-${stamp}@company.test.local`,
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
    mockRequireTicketRead.mockResolvedValue({ companyId });

    const [museo] = await db
      .insert(client)
      .values({ name: 'Museo de Arte Contemporáneo', company_id: companyId })
      .returning({ id: client.id });

    await seedTicket({ client_id: museo.id, client_name: 'Museo de Arte Contemporáneo', total: 1210, finished: true, folio_number: 16, folio_prefix: 'R', ticket_date: new Date('2026-01-02T18:00:00Z') });
    const partial = await seedTicket({ client_id: museo.id, client_name: 'Museo de Arte Contemporáneo', total: 2000, paid: 400, finished: true, folio_number: 36, folio_prefix: 'R' });
    await seedTicket({ client_name: 'Sin registro', total: 500, finished: true, folio_number: 40, folio_prefix: 'R' });
    // En proceso with a saldo: out of Cobranza and out of Hoy.
    await seedTicket({ client_name: 'Obra', total: 90000, paid: 1000, finished: false, folio_number: 41, folio_prefix: 'R' });
    // Paid, zero-total, presupuesto and deleted: never cobrables.
    await seedTicket({ client_name: 'Pagado', total: 300, paid: 300, finished: true, folio_number: 42, folio_prefix: 'R' });
    await seedTicket({ client_name: 'Cero', total: 0, finished: true, folio_number: 43, folio_prefix: 'R' });
    await seedTicket({ client_name: 'Cotización', document_kind: 'presupuesto', total: 800, finished: false, folio_number: 1, folio_prefix: 'P' });
    await seedTicket({ client_name: 'Borrado', total: 700, finished: true, folio_number: 44, folio_prefix: 'R', deleted_at: new Date() });

    await db.insert(ticketPayment).values({
      ticket_id: partial,
      amount: 400,
      company_id: companyId,
      created_at: new Date(),
    });
  });

  afterAll(async () => {
    if (ticketIds.length > 0) {
      await db.delete(ticketPayment).where(inArray(ticketPayment.ticket_id, ticketIds));
      await db.delete(ticket).where(inArray(ticket.id, ticketIds));
    }
    if (companyId) {
      await db.delete(client).where(inArray(client.company_id, [companyId]));
      await db.delete(company).where(inArray(company.id, [companyId]));
    }
    await (globalThis as { pool?: { end: () => Promise<void> } }).pool?.end();
  });

  it('Hoy › Saldo por cobrar equals the Cobranza total', async () => {
    const cobranza = await getCobranzaPaginated({});
    expect(cobranza.success).toBe(true);
    const data = cobranza.data!;
    expect(data.buckets.all).toMatchObject({ count: 3, amount: 3310 });
    expect(data.rows.map((row) => row.folio).sort()).toEqual(['R-0016', 'R-0036', 'R-0040']);
    expect(data.inProgress).toEqual({ count: 1, total: 89000 });
    expect(data.collectedThisMonth).toMatchObject({ amount: 400, payments: 1 });
    expect(data.rows.find((row) => row.folio === 'R-0036')?.daysSinceLastPayment).toBe(0);

    const metrics = await loadDashboardMetricsForCompany(companyId, 1);
    expect(metrics.success).toBe(true);
    const outstanding = metrics.data!.kpis.find((kpi) => kpi.key === 'outstandingBalance')?.value;
    expect(outstanding).toBe(data.buckets.all.amount);
  });

  it('groups the museum into one row with $2,810.00', async () => {
    const { data } = await getCobranzaPaginated({ groupBy: 'client' });
    const museo = data!.groups.find((group) => group.client_name === 'Museo de Arte Contemporáneo')!;
    expect(museo.balanceDue).toBe(2810);
    expect(museo.tickets.map((row) => row.folio)).toEqual(['R-0016', 'R-0036']);
  });
});
