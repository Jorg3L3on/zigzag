/**
 * @jest-environment node
 *
 * MCP write tools against a real Postgres (ZIG-I23-6). Needs a migrated,
 * disposable database on this machine; never Neon:
 *   DATABASE_URL=postgresql://localhost:5433/<scratch> npx jest src/lib/mcp/tools/writes.db.test.ts
 * Only the token resolution is mocked (the connection holds `write`, which
 * ZIG-I23-11 made opt-in); folios, totals, audit and scoping are real.
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
import { toComposerLines } from '@/lib/mcp/domain/writes';
import { createDocumentOutputSchema, registerWriteTools } from '@/lib/mcp/tools/writes';
import { getClientOutputSchema, getDocumentOutputSchema } from '@/lib/mcp/schemas';
import { calculateTicketTotal } from '@/lib/ticket-financials';
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

describeWithLocalDb('MCP write tools (real Postgres)', () => {
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

  const mixedLines = () => [
    {
      service_id: serviceA,
      quantity: 2,
      price: 650,
      materials: [{ material_id: materialA, quantity: 1.5, price: 120 }],
    },
    {
      name: 'Revisión de fuga',
      quantity: 1.25,
      price: 400,
      materials: [{ name: 'Cinta aislante', unit: 'pza', quantity: 2, price: 15.5 }],
    },
  ];
  // 2 × 650 + 1.5 × 120 + 1.25 × 400 + 2 × 15.5
  const MIXED_TOTAL = 2011;

  beforeAll(async () => {
    fixtureA = await createMcpDbFixture('writes-a');
    fixtureB = await createMcpDbFixture('writes-b');
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
      .set({ scopes: ['read', 'write'], name: 'Agente de pruebas' })
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

  describe('create_document', () => {
    it('creates a ticket with catalog and inline lines and materials, next R folio, composer total', async () => {
      const result = ok(
        await callTool('create_document', {
          company_id: companyA,
          kind: 'ticket',
          client: { client_id: clientA },
          lines: mixedLines(),
          work_notes: 'Cliente pidió revisar la fuga',
        }),
      );
      createDocumentOutputSchema.parse(result);
      const doc = result.document as Doc;

      // The composer's own maths for the same lines.
      expect(doc.total).toBe(calculateTicketTotal(toComposerLines(mixedLines())));
      expect(doc.total).toBe(MIXED_TOTAL);
      expect(doc.kind).toBe('ticket');
      expect(doc.folio).toMatchObject({ prefix: 'R', number: 1 });
      expect(doc.lines.map((line) => line.name)).toEqual(['Mantenimiento minisplit', 'Revisión de fuga']);
      expect(doc.lines.map((line) => line.materials.length)).toEqual([1, 1]);
      expect(doc.finished).toBe(false);
      expect(doc.payment_status).toBe('pendiente');
      expect(doc.work_notes).toBe('Cliente pidió revisar la fuga');
      expect(result.replayed).toBe(false);

      const second = ok(
        await callTool('create_document', {
          company_id: companyA,
          kind: 'ticket',
          client: { client_id: clientA },
          lines: [{ name: 'Visita', quantity: 1, price: 300 }],
        }),
      ).document as Doc;
      expect(second.folio).toMatchObject({ prefix: 'R', number: 2 });
    });

    it('creates a presupuesto with its own P folio and the same total', async () => {
      const doc = ok(
        await callTool('create_document', {
          company_id: companyA,
          kind: 'presupuesto',
          client: { client_id: clientA },
          lines: mixedLines(),
          expires_at: '2099-01-31',
        }),
      ).document as Doc;
      expect(doc.kind).toBe('presupuesto');
      expect(doc.folio).toMatchObject({ prefix: 'P', number: 1 });
      expect(doc.total).toBe(MIXED_TOTAL);
    });

    it('audits the tool and the connection, as source api', async () => {
      const doc = ok(
        await callTool('create_document', {
          company_id: companyA,
          kind: 'ticket',
          client: { client_id: clientA },
          lines: [{ name: 'Carga de gas', quantity: 1, price: 900 }],
        }),
      ).document as Doc;
      const [event] = await db
        .select()
        .from(ticketAuditEvent)
        .where(
          and(eq(ticketAuditEvent.ticket_id, BigInt(doc.id)), eq(ticketAuditEvent.event_type, 'created')),
        );
      expect(event.payload).toMatchObject({
        source: 'mcp',
        mcp: {
          tool: 'create_document',
          connection: { kind: 'api_key', id: keyId, name: 'Agente de pruebas' },
        },
      });
      const unified = await db
        .select()
        .from(auditEvent)
        .where(
          and(
            eq(auditEvent.resource_type, 'ticket'),
            eq(auditEvent.resource_id, doc.id),
            eq(auditEvent.action, 'created'),
          ),
        );
      expect(unified).toHaveLength(1);
      expect(unified[0].source).toBe('api');
      expect(unified[0].payload).toMatchObject({
        mcp: { tool: 'create_document', connection: { name: 'Agente de pruebas' } },
      });
    });

    it('a retry with the same idempotency_key returns the first document and creates no second row', async () => {
      const args = {
        company_id: companyA,
        kind: 'ticket',
        client: { name: 'Cliente idempotente', phone: '55 4444 3333' },
        lines: [{ name: 'Instalación', quantity: 1, price: 2500 }],
        idempotency_key: `retry-${Date.now()}`,
      };
      const first = ok(await callTool('create_document', args));
      const before = await countDocuments(companyA);
      const clientsBefore = await db.select().from(client).where(eq(client.company_id, companyA));

      const retry = ok(await callTool('create_document', args));
      expect((retry.document as Doc).id).toBe((first.document as Doc).id);
      expect(retry.replayed).toBe(true);
      expect(await countDocuments(companyA)).toBe(before);
      expect(await db.select().from(client).where(eq(client.company_id, companyA))).toHaveLength(
        clientsBefore.length,
      );

      // Two concurrent calls with a fresh key still make one document.
      const raced = { ...args, idempotency_key: `race-${Date.now()}` };
      const [a, b] = await Promise.all([callTool('create_document', raced), callTool('create_document', raced)]);
      expect((ok(a).document as Doc).id).toBe((ok(b).document as Doc).id);
      expect(await countDocuments(companyA)).toBe(before + 1);
    });

    it('reuses the client with that phone and records the payment choice on tickets', async () => {
      const paid = ok(
        await callTool('create_document', {
          company_id: companyA,
          kind: 'ticket',
          client: { name: 'Ana P.', phone: '(55) 1111-2222' },
          lines: [{ name: 'Limpieza', quantity: 1, price: 650 }],
          payment: 'pagado',
        }),
      ).document as Doc;
      expect(paid.client.id).toBe(clientA);
      expect(paid).toMatchObject({ finished: true, paid: 650, payment_status: 'pagado' });

      const partial = ok(
        await callTool('create_document', {
          company_id: companyA,
          kind: 'ticket',
          client: { client_id: clientA },
          lines: [{ name: 'Limpieza', quantity: 1, price: 650 }],
          payment: { parcial: 200 },
        }),
      ).document as Doc;
      expect(partial).toMatchObject({ finished: true, paid: 200, payment_status: 'parcial' });

      expectError(
        await callTool('create_document', {
          company_id: companyA,
          kind: 'ticket',
          client: { client_id: clientA },
          lines: [{ name: 'Limpieza', quantity: 1, price: 650 }],
          payment: { parcial: 700 },
        }),
        'validation',
      );
    });

    it('applies the composer limits (ZIG-I12) and the catalog of the company', async () => {
      const before = await countDocuments(companyA);
      expectError(
        await callTool('create_document', {
          company_id: companyA,
          kind: 'ticket',
          client: { client_id: clientA },
          lines: [{ name: 'Mucho', quantity: 1.234, price: 1 }],
        }),
        'validation',
      );
      expectError(
        await callTool('create_document', {
          company_id: companyA,
          kind: 'ticket',
          client: { client_id: clientA },
          lines: [{ service_id: serviceB, quantity: 1, price: 1 }],
        }),
        'validation',
      );
      expect(await countDocuments(companyA)).toBe(before);
    });
  });

  describe('update_document', () => {
    it('replaces the lines of an unpaid document and keeps its folio', async () => {
      const created = ok(
        await callTool('create_document', {
          company_id: companyA,
          kind: 'ticket',
          client: { client_id: clientA },
          lines: [{ name: 'Visita', quantity: 1, price: 300 }],
        }),
      ).document as Doc;

      const updated = getDocumentOutputSchema.parse(
        ok(
          await callTool('update_document', {
            company_id: companyA,
            document_id: created.id,
            lines: mixedLines(),
            work_notes: 'Se cambió el alcance',
          }),
        ),
      ).document as unknown as Doc;
      expect(updated.folio).toEqual(created.folio);
      expect(updated.total).toBe(MIXED_TOTAL);
      expect(updated.lines).toHaveLength(2);
      expect(updated.work_notes).toBe('Se cambió el alcance');

      const [event] = await db
        .select()
        .from(ticketAuditEvent)
        .where(
          and(eq(ticketAuditEvent.ticket_id, BigInt(created.id)), eq(ticketAuditEvent.event_type, 'updated')),
        );
      expect(event.payload).toMatchObject({
        mcp: { tool: 'update_document', document_id: created.id },
      });
    });

    it('refuses a fully paid document with validation and leaves it alone', async () => {
      const paid = ok(
        await callTool('create_document', {
          company_id: companyA,
          kind: 'ticket',
          client: { client_id: clientA },
          lines: [{ name: 'Limpieza', quantity: 1, price: 650 }],
          payment: 'pagado',
        }),
      ).document as Doc;
      const message = expectError(
        await callTool('update_document', {
          company_id: companyA,
          document_id: paid.id,
          lines: [{ name: 'Otra cosa', quantity: 1, price: 1 }],
        }),
        'validation',
      );
      expect(message).toMatch(/pagado/);
      const lines = await db
        .select()
        .from(servicesTickets)
        .where(eq(servicesTickets.ticket_id, BigInt(paid.id)));
      expect(lines.filter((line) => line.deleted_at == null).map((line) => line.name)).toEqual(['Limpieza']);
    });
  });

  describe('convert_presupuesto', () => {
    it('converts into a new R ticket with source_presupuesto_folio, then refuses edits and a second conversion', async () => {
      const quote = ok(
        await callTool('create_document', {
          company_id: companyA,
          kind: 'presupuesto',
          client: { client_id: clientA },
          lines: mixedLines(),
        }),
      ).document as Doc;

      const converted = ok(
        await callTool('convert_presupuesto', { company_id: companyA, document_id: quote.id }),
      ).document as Doc;
      expect(converted.kind).toBe('ticket');
      expect(converted.folio.prefix).toBe('R');
      expect(converted.total).toBe(MIXED_TOTAL);
      expect(converted.source_presupuesto_folio?.label).toBe(quote.folio.label);

      expectError(
        await callTool('convert_presupuesto', { company_id: companyA, document_id: quote.id }),
        'validation',
      );
      expectError(
        await callTool('update_document', {
          company_id: companyA,
          document_id: quote.id,
          work_notes: 'tarde',
        }),
        'validation',
      );
    });
  });

  describe('clients', () => {
    it('creates and updates a client; a repeated phone names the existing client_id', async () => {
      const created = getClientOutputSchema.parse(
        ok(
          await callTool('create_client', {
            company_id: companyA,
            name: 'Talleres Gómez',
            phone: '(55) 7777-8888',
            email: 'gomez@example.com',
            document: 'TGO010101AAA',
            notes: 'Pagan a 15 días',
            address: { street: 'Calle 5', exterior_number: '12', city: 'Toluca', postal_code: '50000' },
          }),
        ),
      ).client;
      expect(created).toMatchObject({
        name: 'Talleres Gómez',
        phone: '5577778888',
        notes: 'Pagan a 15 días',
        address: { street: 'Calle 5', city: 'Toluca' },
      });

      const duplicate = expectError(
        await callTool('create_client', { company_id: companyA, name: 'Otro', phone: '5577778888' }),
        'validation',
      );
      expect(duplicate).toContain(`client_id ${created.id}`);

      const updated = ok(
        await callTool('update_client', {
          company_id: companyA,
          client_id: created.id,
          phone: '5577770000',
          address: { city: 'Metepec' },
        }),
      ).client as { phone: string; address: { city: string; street: string } };
      expect(updated.phone).toBe('5577770000');
      expect(updated.address).toMatchObject({ city: 'Metepec', street: 'Calle 5' });

      expectError(
        await callTool('update_client', { company_id: companyA, client_id: created.id, phone: '5511112222' }),
        'validation',
      );

      const [audit] = await db
        .select()
        .from(auditEvent)
        .where(
          and(
            eq(auditEvent.resource_type, 'client'),
            eq(auditEvent.resource_id, String(created.id)),
            eq(auditEvent.action, 'created'),
          ),
        );
      expect(audit.source).toBe('api');
      expect(audit.payload).toMatchObject({ mcp: { tool: 'create_client' } });
    });
  });

  describe('isolation', () => {
    it('refuses another company and another company’s rows', async () => {
      expectError(
        await callTool('create_client', { company_id: companyB, name: 'X', phone: '5512345678' }),
        'forbidden',
      );
      expectError(
        await callTool('create_document', {
          company_id: companyB,
          kind: 'ticket',
          client: { client_id: clientB },
          lines: [{ name: 'X', quantity: 1, price: 1 }],
        }),
        'forbidden',
      );

      // Rows of company B through company A's allow-list: not found.
      expectError(
        await callTool('create_document', {
          company_id: companyA,
          kind: 'ticket',
          client: { client_id: clientB },
          lines: [{ name: 'X', quantity: 1, price: 1 }],
        }),
        'not_found',
      );
      expectError(
        await callTool('update_client', { company_id: companyA, client_id: clientB, name: 'Robado' }),
        'not_found',
      );

      const [quoteB] = await db
        .insert(ticket)
        .values({
          company_id: companyB,
          document_kind: 'presupuesto',
          client_name: 'Cliente de B',
          folio_prefix: 'P',
          folio_number: 900,
        })
        .returning({ id: ticket.id });
      expectError(
        await callTool('convert_presupuesto', { company_id: companyA, document_id: String(quoteB.id) }),
        'not_found',
      );
      expectError(
        await callTool('update_document', {
          company_id: companyA,
          document_id: String(quoteB.id),
          work_notes: 'x',
        }),
        'not_found',
      );
      const [after] = await db.select().from(ticket).where(eq(ticket.id, quoteB.id));
      expect(after.converted_to_ticket_id).toBeNull();
      expect(after.work_notes).toBeNull();
      expect(
        await db.select().from(client).where(and(eq(client.id, clientB), eq(client.name, 'Cliente de B'))),
      ).toHaveLength(1);
    });
  });
});
