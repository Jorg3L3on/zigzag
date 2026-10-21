/**
 * @jest-environment node
 *
 * register_payment and the payments scope against a real Postgres (ZIG-I23-7).
 * Needs a migrated, disposable database on this machine; never Neon:
 *   DATABASE_URL=postgresql://localhost:5433/<scratch> npx jest src/lib/mcp/tools/payments.db.test.ts
 * Only the token resolution is mocked; the scope check, the payment path,
 * payment rows, status and audit are real.
 */
import { InMemoryTransport, McpServer } from '@modelcontextprotocol/server';
import { and, eq, inArray, sql } from 'drizzle-orm';
import {
  apiKey,
  auditEvent,
  client,
  company,
  documentFolioCounter,
  material,
  service,
  servicesTickets,
  ticket,
  ticketAuditEvent,
  ticketLineMaterial,
  ticketPayment,
} from '@/db/schema';
import { db } from '@/lib/db';
import { registerPaymentOutputSchema, registerPaymentTools } from '@/lib/mcp/tools/payments';
import { registerWriteTools } from '@/lib/mcp/tools/writes';
import {
  cleanupMcpDbFixture,
  createMcpDbFixture,
  describeWithLocalDb,
  type McpDbFixture,
} from '@/test/mcp-db-fixtures';

jest.mock('@/lib/logger', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}));

jest.mock('@/lib/rate-limiter', () => ({
  checkRateLimit: jest.fn().mockResolvedValue(true),
}));

jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }));

// The real resolver pulls in next-auth (ESM). The agent below stands for an
// API key that holds read + write on company A only.
const mockAgent = { current: null as null | Record<string, unknown> };
jest.mock('@/lib/server/resolve-agent-context', () => {
  class MockAgentAuthError extends Error {
    readonly status: number;
    constructor(message: string, status: number) {
      super(message);
      this.status = status;
    }
  }
  return {
    AgentAuthError: MockAgentAuthError,
    parseBearerToken: jest.fn(() => 'zigzag_test'),
    resolveAgentUser: jest.fn(),
    assertScope: jest.fn((agent: { scopes: string[] }, scope: string) => {
      if (!agent.scopes.includes(scope)) {
        throw new MockAgentAuthError(`El token no tiene el scope "${scope}"`, 403);
      }
    }),
    resolveAgentContext: jest.fn(async (_header: unknown, companyId: number) => {
      const agent = mockAgent.current as { allowedCompanyIds: number[] };
      if (!agent.allowedCompanyIds.includes(companyId)) {
        throw new MockAgentAuthError('Compañía no autorizada para esta conexión', 403);
      }
      return { ...agent, companyId };
    }),
  };
});

if (/neon\.tech/.test(process.env.DATABASE_URL ?? '')) {
  throw new Error('writes.db.test.ts must not run against Neon');
}

type CallResult = {
  content: Array<{ type: string; text: string }>;
  structuredContent: Record<string, unknown>;
  isError?: boolean;
};

type Doc = {
  id: string;
  kind: string;
  folio: { prefix: string; number: number; label: string };
  total: number;
  paid: number;
  finished: boolean;
  payment_status: string;
  lines: Array<{ name: string; quantity: number; price: number; materials: unknown[] }>;
  client: { id: number | null; name: string | null };
  source_presupuesto_folio: { label: string } | null;
  work_notes: string | null;
};

describeWithLocalDb('register_payment and the payments scope (real Postgres)', () => {
  let fixtureA: McpDbFixture | null = null;
  let fixtureB: McpDbFixture | null = null;
  let companyA = 0;
  let companyB = 0;
  let keyId = 0;
  let clientA = 0;
  let clientB = 0;
  let serviceA = 0;
  let materialA = 0;
  let serviceB = 0;

  let transport: InMemoryTransport;
  let nextId = 1;
  const pending = new Map<number, (message: { result?: unknown }) => void>();

  const callTool = (name: string, args: Record<string, unknown>) =>
    new Promise<CallResult>((resolve) => {
      const id = nextId++;
      pending.set(id, (message) => resolve(message.result as CallResult));
      void transport.send({
        jsonrpc: '2.0',
        id,
        method: 'tools/call',
        params: { name, arguments: args },
      });
    });

  const ok = (result: CallResult) => {
    if (result.isError) throw new Error(JSON.stringify(result.structuredContent));
    expect(JSON.parse(result.content[0].text)).toEqual(result.structuredContent);
    return result.structuredContent;
  };

  const expectError = (result: CallResult, code: string) => {
    expect(result.isError).toBe(true);
    expect(result.structuredContent).toMatchObject({ error: { code } });
    return (result.structuredContent.error as { message: string }).message;
  };

  const countDocuments = async (companyId: number) => {
    const [row] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(ticket)
      .where(eq(ticket.company_id, companyId));
    return row.n;
  };


  beforeAll(async () => {
    fixtureA = await createMcpDbFixture('payments-a');
    fixtureB = await createMcpDbFixture('payments-b');
    companyA = fixtureA.companyId;
    companyB = fixtureB.companyId;
    // Production-ready, like a real tenant: documents are refused otherwise.
    await db
      .update(company)
      .set({ settings: { rfc: 'XAXX010101000', default_currency: 'MXN' } })
      .where(inArray(company.id, [companyA, companyB]));

    // ZIG-I23-11: write is opt-in, so this connection was granted it.
    const [key] = await db
      .update(apiKey)
      .set({ scopes: ['read', 'write'], name: 'Agente de cobros' })
      .where(eq(apiKey.user_id, fixtureA.userId))
      .returning({ id: apiKey.id });
    keyId = key.id;
    mockAgent.current = {
      userId: fixtureA.userId,
      scopes: ['read', 'write'],
      allowedCompanyIds: [companyA],
      authSource: 'api_key',
      apiKeyId: keyId,
      rateLimitIdentity: keyId,
    };

    const clients = await db
      .insert(client)
      .values([
        { name: 'Ana Pérez', phone: '5511112222', company_id: companyA },
        { name: 'Cliente de B', phone: '5599990000', company_id: companyB },
      ])
      .returning({ id: client.id });
    [clientA, clientB] = clients.map((row) => row.id);

    const services = await db
      .insert(service)
      .values([
        { name: 'Mantenimiento minisplit', description: 'Limpieza', price: 650, company_id: companyA },
        { name: 'Servicio de B', description: 'x', price: 1, company_id: companyB },
      ])
      .returning({ id: service.id });
    [serviceA, serviceB] = services.map((row) => row.id);
    const [mat] = await db
      .insert(material)
      .values({ company_id: companyA, name: 'Tubo de cobre', unit: 'm', price: 120 })
      .returning({ id: material.id });
    materialA = mat.id;

    const server = new McpServer(
      { name: 'zigzag', version: '2.0.0' },
      { capabilities: { tools: { listChanged: true } } },
    );
    registerWriteTools(server);
    registerPaymentTools(server);
    const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
    transport = clientSide;
    transport.onmessage = (message) => {
      const response = message as unknown as { id: number; result?: unknown };
      pending.get(response.id)?.(response);
      pending.delete(response.id);
    };
    await server.connect(serverSide);
    await transport.start();
    await new Promise<void>((resolve) => {
      const id = nextId++;
      pending.set(id, () => resolve());
      void transport.send({
        jsonrpc: '2.0',
        id,
        method: 'initialize',
        params: {
          protocolVersion: '2025-06-18',
          capabilities: {},
          clientInfo: { name: 'jest', version: '0.0.0' },
        },
      });
    });
    await transport.send({ jsonrpc: '2.0', method: 'notifications/initialized' });
  });

  afterAll(async () => {
    const companies = [companyA, companyB].filter(Boolean);
    if (companies.length > 0) {
      const ticketIds = (
        await db.select({ id: ticket.id }).from(ticket).where(inArray(ticket.company_id, companies))
      ).map((row) => row.id);
      if (ticketIds.length > 0) {
        const lineIds = (
          await db
            .select({ id: servicesTickets.id })
            .from(servicesTickets)
            .where(inArray(servicesTickets.ticket_id, ticketIds))
        ).map((row) => row.id);
        if (lineIds.length > 0) {
          await db
            .delete(ticketLineMaterial)
            .where(inArray(ticketLineMaterial.services_tickets_id, lineIds));
        }
        await db.delete(servicesTickets).where(inArray(servicesTickets.ticket_id, ticketIds));
        await db.delete(ticketPayment).where(inArray(ticketPayment.ticket_id, ticketIds));
        await db.delete(ticketAuditEvent).where(inArray(ticketAuditEvent.ticket_id, ticketIds));
        await db.update(ticket).set({ converted_from_ticket_id: null, converted_to_ticket_id: null }).where(inArray(ticket.id, ticketIds));
        await db.delete(ticket).where(inArray(ticket.id, ticketIds));
      }
      await db.delete(auditEvent).where(inArray(auditEvent.target_company_id, companies));
      await db.delete(documentFolioCounter).where(inArray(documentFolioCounter.company_id, companies));
      await db.delete(client).where(inArray(client.company_id, companies));
      await db.delete(service).where(inArray(service.company_id, companies));
      await db.delete(material).where(inArray(material.company_id, companies));
    }
    await cleanupMcpDbFixture(fixtureA);
    await cleanupMcpDbFixture(fixtureB);
    await transport?.close();
    await db.$client.end();
  });

  const withScopes = (scopes: string[]) => {
    mockAgent.current = { ...(mockAgent.current as Record<string, unknown>), scopes };
  };

  const newFinishedTicket = async (price = 1000) =>
    ok(
      await callTool('create_document', {
        company_id: companyA,
        kind: 'ticket',
        client: { client_id: clientA },
        lines: [{ name: 'Instalación', quantity: 1, price }],
        payment: 'pendiente',
      }),
    ).document as Doc;

  const paymentRows = async (documentId: string) =>
    db.select().from(ticketPayment).where(eq(ticketPayment.ticket_id, BigInt(documentId)));

  it('a connection without payments is forbidden, for register_payment and for paid create_document', async () => {
    withScopes(['read', 'write']);
    const doc = await newFinishedTicket();
    expect(doc).toMatchObject({ finished: true, paid: 0, payment_status: 'pendiente' });

    expectError(
      await callTool('register_payment', { company_id: companyA, document_id: doc.id, amount: 100 }),
      'forbidden',
    );
    const before = await countDocuments(companyA);
    expectError(
      await callTool('create_document', {
        company_id: companyA,
        kind: 'ticket',
        client: { client_id: clientA },
        lines: [{ name: 'Limpieza', quantity: 1, price: 650 }],
        payment: 'pagado',
      }),
      'forbidden',
    );
    expect(await countDocuments(companyA)).toBe(before);
    expect(await paymentRows(doc.id)).toHaveLength(0);
  });

  it('with payments it registers a partial and then the full balance, and payment_status follows', async () => {
    withScopes(['read', 'write', 'payments']);
    const doc = await newFinishedTicket(1000);

    const partial = registerPaymentOutputSchema.parse(
      ok(
        await callTool('register_payment', {
          company_id: companyA,
          document_id: doc.id,
          amount: 250.5,
          method: 'transferencia',
          note: 'Anticipo',
        }),
      ),
    );
    expect(partial.document).toMatchObject({ paid: 250.5, balance: 749.5, payment_status: 'parcial' });
    expect(partial.replayed).toBe(false);

    const full = ok(
      await callTool('register_payment', { company_id: companyA, document_id: doc.id, amount: 749.5 }),
    ).document as Doc & { balance: number };
    expect(full).toMatchObject({ paid: 1000, balance: 0, payment_status: 'pagado' });

    expect((await paymentRows(doc.id)).map((row) => row.amount).sort()).toEqual([250.5, 749.5]);

    const audits = await db
      .select()
      .from(ticketAuditEvent)
      .where(
        and(
          eq(ticketAuditEvent.ticket_id, BigInt(doc.id)),
          eq(ticketAuditEvent.event_type, 'payment_collected'),
        ),
      );
    expect(audits).toHaveLength(2);
    expect(audits.map((row) => row.payload)).toContainEqual(
      expect.objectContaining({
        payment: { requestedAmount: 250.5, appliedAmount: 250.5 },
        mcp: expect.objectContaining({
          tool: 'register_payment',
          payment_method: 'transferencia',
          payment_note: 'Anticipo',
          connection: expect.objectContaining({ kind: 'api_key', name: 'Agente de cobros' }),
        }),
      }),
    );
    const unified = await db
      .select()
      .from(auditEvent)
      .where(
        and(
          eq(auditEvent.resource_type, 'ticket'),
          eq(auditEvent.resource_id, doc.id),
          eq(auditEvent.action, 'payment_collected'),
        ),
      );
    expect(unified.every((row) => row.source === 'api')).toBe(true);

    // With payments, create_document may record a paid ticket too.
    const paid = ok(
      await callTool('create_document', {
        company_id: companyA,
        kind: 'ticket',
        client: { client_id: clientA },
        lines: [{ name: 'Limpieza', quantity: 1, price: 650 }],
        payment: 'pagado',
      }),
    ).document as Doc;
    expect(paid).toMatchObject({ paid: 650, payment_status: 'pagado' });
  });

  it('refuses an amount above the balance, a presupuesto, an open ticket and a paid one', async () => {
    withScopes(['read', 'write', 'payments']);
    const doc = await newFinishedTicket(500);
    expect(
      expectError(
        await callTool('register_payment', { company_id: companyA, document_id: doc.id, amount: 500.01 }),
        'validation',
      ),
    ).toMatch(/mayor al saldo/);

    const quote = ok(
      await callTool('create_document', {
        company_id: companyA,
        kind: 'presupuesto',
        client: { client_id: clientA },
        lines: [{ name: 'Instalación', quantity: 1, price: 900 }],
      }),
    ).document as Doc;
    expect(
      expectError(
        await callTool('register_payment', { company_id: companyA, document_id: quote.id, amount: 100 }),
        'validation',
      ),
    ).toMatch(/presupuestos/);

    const open = ok(
      await callTool('create_document', {
        company_id: companyA,
        kind: 'ticket',
        client: { client_id: clientA },
        lines: [{ name: 'Visita', quantity: 1, price: 300 }],
      }),
    ).document as Doc;
    expect(
      expectError(
        await callTool('register_payment', { company_id: companyA, document_id: open.id, amount: 100 }),
        'validation',
      ),
    ).toMatch(/Termina el ticket/);

    ok(await callTool('register_payment', { company_id: companyA, document_id: doc.id, amount: 500 }));
    expectError(
      await callTool('register_payment', { company_id: companyA, document_id: doc.id, amount: 1 }),
      'validation',
    );
    // amount must be > 0: the SDK rejects it against the input schema.
    expect(
      (await callTool('register_payment', { company_id: companyA, document_id: doc.id, amount: 0 }))
        .isError,
    ).toBe(true);
    for (const id of [quote.id, open.id]) {
      expect(await paymentRows(id)).toHaveLength(0);
    }
    expect(await paymentRows(doc.id)).toHaveLength(1);
  });

  it('a retry with the same idempotency_key does not charge twice', async () => {
    withScopes(['read', 'write', 'payments']);
    const doc = await newFinishedTicket(800);
    const args = {
      company_id: companyA,
      document_id: doc.id,
      amount: 300,
      idempotency_key: `pay-${Date.now()}`,
    };
    const first = ok(await callTool('register_payment', args));
    const [a, b] = await Promise.all([
      callTool('register_payment', args),
      callTool('register_payment', args),
    ]);
    expect(first.replayed).toBe(false);
    expect([ok(a).replayed, ok(b).replayed]).toEqual([true, true]);
    expect(await paymentRows(doc.id)).toHaveLength(1);
    expect((ok(a).document as Doc).paid).toBe(300);
  });

  it('another company’s ticket is not found and another company is forbidden', async () => {
    withScopes(['read', 'write', 'payments']);
    const [ticketB] = await db
      .insert(ticket)
      .values({
        company_id: companyB,
        document_kind: 'ticket',
        client_name: 'Cliente de B',
        folio_prefix: 'R',
        folio_number: 900,
        finished: true,
        total: 1000,
        paid: 0,
      })
      .returning({ id: ticket.id });
    expectError(
      await callTool('register_payment', {
        company_id: companyA,
        document_id: String(ticketB.id),
        amount: 100,
      }),
      'not_found',
    );
    expectError(
      await callTool('register_payment', {
        company_id: companyB,
        document_id: String(ticketB.id),
        amount: 100,
      }),
      'forbidden',
    );
    expect(await paymentRows(String(ticketB.id))).toHaveLength(0);
  });
});
