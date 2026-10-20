/**
 * @jest-environment node
 *
 * Catalog and client MCP tools against a real Postgres (ZIG-I23-4). Needs a
 * migrated, disposable database; never Neon. Skipped unless MCP_DB_TEST=1:
 *   MCP_DB_TEST=1 DATABASE_URL=postgresql://localhost:5433/<scratch> \
 *     npx jest src/lib/mcp/tools/catalog.db.test.ts
 * Only the token resolution is mocked; queries, scoping and paging are real.
 */
import { InMemoryTransport, McpServer } from '@modelcontextprotocol/server';
import { inArray } from 'drizzle-orm';
import {
  client,
  company,
  material,
  service,
  serviceMaterial,
  ticket,
} from '@/db/schema';
import { db } from '@/lib/db';
import { decodeCursor } from '@/lib/mcp/cursor';
import {
  getClientOutputSchema,
  listClientsOutputSchema,
  listMaterialsOutputSchema,
  listServicesOutputSchema,
} from '@/lib/mcp/schemas';
import { registerCatalogTools } from '@/lib/mcp/tools/catalog';
import { assertAgentCompanyAccess } from '@/lib/server/resolve-agent-context';

jest.mock('@/lib/logger', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}));

jest.mock('@/lib/rate-limiter', () => ({
  checkRateLimit: jest.fn().mockResolvedValue(true),
}));

// The real resolver pulls in next-auth (ESM); the token part is not under test.
jest.mock('@/lib/server/resolve-agent-context', () => {
  class MockAgentAuthError extends Error {
    readonly status: number;
    constructor(message: string, status: number) {
      super(message);
      this.status = status;
    }
  }
  const agentUser = {
    userId: 5n,
    scopes: ['read'],
    allowedCompanyIds: [],
    authSource: 'api_key',
    apiKeyId: 1,
    rateLimitIdentity: 1,
  };
  return {
    AgentAuthError: MockAgentAuthError,
    parseBearerToken: jest.fn(() => 'zz_test'),
    resolveAgentUser: jest.fn(),
    assertScope: jest.fn(),
    resolveAgentContext: jest.fn(async (_header: unknown, companyId: number) => ({
      ...agentUser,
      companyId,
    })),
    assertAgentCompanyAccess: jest.fn().mockResolvedValue(undefined),
  };
});

const enabled = process.env.MCP_DB_TEST === '1';
const describeDb = enabled ? describe : describe.skip;

if (enabled && /neon\.tech/.test(process.env.DATABASE_URL ?? '')) {
  throw new Error('catalog.db.test.ts must not run against Neon');
}

type CallResult = {
  content: Array<{ type: string; text: string }>;
  structuredContent: Record<string, unknown>;
  isError?: boolean;
};

describeDb('catalog and client tools (real Postgres)', () => {
  const suffix = `${Date.now()}`;
  const ids = {
    companies: [] as number[],
    clients: [] as number[],
    services: [] as number[],
    materials: [] as number[],
  };
  let companyA: number;
  let companyB: number;
  let clientA: number;
  let clientDeleted: number;
  let clientB: number;
  let serviceA1: number;
  let materialA1: number;
  let materialA2: number;

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

  const createCompany = async (label: string) => {
    const [row] = await db
      .insert(company)
      .values({
        name: `MCP catalog ${label} ${suffix}`,
        phone: '5550000000',
        email: `mcp-catalog-${label}-${suffix}@test.local`,
        street: 'x',
        exterior_number: '1',
        neighborhood: 'x',
        city: 'x',
        state: 'x',
        country: 'MX',
        postal_code: '00000',
      })
      .returning({ id: company.id });
    ids.companies.push(row.id);
    return row.id;
  };

  const sameInstant = new Date('2026-03-01T12:00:00.000Z');

  beforeAll(async () => {
    companyA = await createCompany('a');
    companyB = await createCompany('b');

    const clients = await db
      .insert(client)
      .values([
        {
          name: 'Ana Pérez',
          email: 'ana@example.com',
          phone: '5511112222',
          document: 'PEPA800101',
          street: 'Av. Reforma',
          exterior_number: '10',
          interior_number: '3B',
          neighborhood: 'Juárez',
          city: 'CDMX',
          state: 'CDMX',
          postal_code: '06600',
          country: 'MX',
          notes: 'Prefiere visitas por la mañana',
          company_id: companyA,
          created_at: sameInstant,
        },
        { name: 'Beto Ruiz', company_id: companyA, created_at: sameInstant },
        { name: 'Carla Díaz', company_id: companyA, created_at: new Date('2026-02-01T00:00:00Z') },
        {
          name: 'Borrado',
          company_id: companyA,
          deleted_at: new Date(),
          created_at: new Date('2026-04-01T00:00:00Z'),
        },
        { name: 'Ana Otra Compañía', phone: '5599999999', company_id: companyB },
      ])
      .returning({ id: client.id });
    ids.clients.push(...clients.map((row) => row.id));
    [clientA, , , clientDeleted, clientB] = ids.clients;

    const materials = await db
      .insert(material)
      .values([
        { company_id: companyA, name: 'Gas R410 50%_test', unit: 'kg', price: 300, created_at: sameInstant },
        { company_id: companyA, name: 'Tubo de cobre', unit: 'm', price: 120, created_at: sameInstant },
        { company_id: companyA, name: 'Cinta retirada', unit: 'pza', price: 10, deleted_at: new Date() },
        { company_id: companyB, name: 'Material de B', unit: 'pza', price: 1 },
      ])
      .returning({ id: material.id });
    ids.materials.push(...materials.map((row) => row.id));
    const [, , materialDeleted, materialB] = ids.materials;
    [materialA1, materialA2] = ids.materials;

    const services = await db
      .insert(service)
      .values([
        { name: 'Mantenimiento minisplit', description: 'Limpieza', price: 650, company_id: companyA, created_at: sameInstant },
        { name: 'Instalación', description: 'Minisplit 1 ton', price: 2500, company_id: companyA, created_at: sameInstant },
        { name: 'Servicio retirado', description: 'x', price: 1, company_id: companyA, deleted_at: new Date() },
        { name: 'Servicio de B', description: 'x', price: 1, company_id: companyB },
      ])
      .returning({ id: service.id });
    ids.services.push(...services.map((row) => row.id));
    serviceA1 = ids.services[0];
    const serviceB = ids.services[3];

    await db.insert(serviceMaterial).values([
      { service_id: serviceA1, material_id: materialA1, quantity: 0.5, price: 320, sort_order: 0 },
      { service_id: serviceA1, material_id: materialA2, quantity: 2, sort_order: 1 },
      { service_id: serviceA1, material_id: materialDeleted, quantity: 1, sort_order: 2 },
      // A bad cross-company link must never surface B's material in A.
      { service_id: ids.services[1], material_id: materialB, quantity: 1 },
      { service_id: serviceB, material_id: materialB, quantity: 1 },
    ]);

    // 11 live documents for Ana (only 10 come back), one deleted, one in B.
    const docs = Array.from({ length: 11 }, (_, i) => ({
      company_id: companyA,
      client_id: clientA,
      client_name: 'Ana Pérez',
      document_kind: i === 10 ? 'presupuesto' : 'ticket',
      total: 100,
      paid: i === 0 ? 40 : 100,
      finished: true,
      created_at: new Date(Date.UTC(2026, 4, 1 + i)),
    }));
    await db.insert(ticket).values([
      ...docs,
      { company_id: companyA, client_id: clientA, total: 999, paid: 0, finished: true, deleted_at: new Date() },
      { company_id: companyB, client_id: clientA, total: 555, paid: 0, finished: true },
    ]);

    const server = new McpServer(
      { name: 'zigzag', version: '2.0.0' },
      { capabilities: { tools: { listChanged: true } } },
    );
    registerCatalogTools(server);
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
    if (ids.companies.length > 0) {
      await db.delete(ticket).where(inArray(ticket.company_id, ids.companies));
      if (ids.services.length > 0) {
        await db.delete(serviceMaterial).where(inArray(serviceMaterial.service_id, ids.services));
        await db.delete(service).where(inArray(service.id, ids.services));
      }
      if (ids.materials.length > 0) {
        await db.delete(material).where(inArray(material.id, ids.materials));
      }
      if (ids.clients.length > 0) {
        await db.delete(client).where(inArray(client.id, ids.clients));
      }
      await db.delete(company).where(inArray(company.id, ids.companies));
    }
    await transport?.close();
    await db.$client.end();
  });

  const ok = (result: CallResult) => {
    expect(result.isError).toBeUndefined();
    expect(JSON.parse(result.content[0].text)).toEqual(result.structuredContent);
    return result.structuredContent;
  };

  const expectError = (result: CallResult, code: string) => {
    expect(result.isError).toBe(true);
    expect(result.structuredContent).toMatchObject({ error: { code } });
  };

  /** Walks every page with `limit` and returns all items. */
  const collect = async (tool: string, key: string, args: Record<string, unknown>) => {
    const all: Array<Record<string, unknown>> = [];
    let cursor: string | undefined;
    for (let pageCount = 0; pageCount < 20; pageCount += 1) {
      const page = ok(await callTool(tool, { ...args, ...(cursor ? { cursor } : {}) }));
      all.push(...(page[key] as Array<Record<string, unknown>>));
      cursor = (page.next_cursor as string | null) ?? undefined;
      if (!cursor) return all;
    }
    throw new Error('paging did not end');
  };

  it('list_services returns each service with its default materials, scoped to the company', async () => {
    const data = ok(await callTool('list_services', { company_id: companyA }));
    expect(listServicesOutputSchema.safeParse(data).error).toBeUndefined();
    const services = data.services as Array<Record<string, unknown>>;
    expect(services.map((row) => row.name).sort()).toEqual(['Instalación', 'Mantenimiento minisplit']);
    const maintenance = services.find((row) => row.id === serviceA1)!;
    expect(maintenance).toMatchObject({ price: 650, description: 'Limpieza' });
    expect(maintenance.default_materials).toEqual([
      { material_id: materialA1, name: 'Gas R410 50%_test', quantity: 0.5, unit: 'kg', price: 320 },
      { material_id: materialA2, name: 'Tubo de cobre', quantity: 2, unit: 'm', price: 120 },
    ]);
    expect(services.find((row) => row.name === 'Instalación')!.default_materials).toEqual([]);
  });

  it('list_services pages with cursor (ties on created_at break by id) and filters by query', async () => {
    const all = await collect('list_services', 'services', { company_id: companyA, limit: 1 });
    expect(all.map((row) => row.id)).toEqual([...ids.services.slice(0, 2)].sort((a, b) => b - a));
    const found = ok(await callTool('list_services', { company_id: companyA, query: '1 TON' }));
    expect((found.services as Array<{ name: string }>).map((row) => row.name)).toEqual(['Instalación']);
  });

  it('list_materials pages with cursor, escapes wildcards and hides deleted or foreign rows', async () => {
    const all = await collect('list_materials', 'materials', { company_id: companyA, limit: 1 });
    expect(listMaterialsOutputSchema.safeParse({ materials: all, next_cursor: null }).error).toBeUndefined();
    expect(all.map((row) => row.id)).toEqual([materialA2, materialA1]);
    expect(all[0]).toEqual({ id: materialA2, name: 'Tubo de cobre', unit: 'm', price: 120 });
    const wildcard = ok(await callTool('list_materials', { company_id: companyA, query: '50%_' }));
    expect((wildcard.materials as Array<{ id: number }>).map((row) => row.id)).toEqual([materialA1]);
    const none = ok(await callTool('list_materials', { company_id: companyA, query: 'o_' }));
    expect(none.materials).toEqual([]);
  });

  it('list_clients pages with cursor, searches and keeps minimal fields', async () => {
    const all = await collect('list_clients', 'clients', { company_id: companyA, limit: 2 });
    expect(all.map((row) => row.name)).toEqual(['Beto Ruiz', 'Ana Pérez', 'Carla Díaz']);
    expect(Object.keys(all[0]).sort()).toEqual(
      ['company_id', 'created_at', 'document', 'email', 'id', 'name'].sort(),
    );
    const byPhone = ok(await callTool('list_clients', { company_id: companyA, query: '1111' }));
    expect(listClientsOutputSchema.safeParse(byPhone).error).toBeUndefined();
    expect((byPhone.clients as Array<{ id: number }>).map((row) => row.id)).toEqual([clientA]);
    const fromB = ok(await callTool('list_clients', { company_id: companyB, query: 'Ana' }));
    expect((fromB.clients as Array<{ id: number }>).map((row) => row.id)).toEqual([clientB]);
  });

  it('get_client returns contact fields, balance and the last 10 documents', async () => {
    const data = ok(await callTool('get_client', { company_id: companyA, client_id: clientA }));
    expect(getClientOutputSchema.safeParse(data).error).toBeUndefined();
    const detail = data.client as Record<string, unknown>;
    expect(detail).toMatchObject({
      id: clientA,
      name: 'Ana Pérez',
      phone: '5511112222',
      email: 'ana@example.com',
      document: 'PEPA800101',
      notes: 'Prefiere visitas por la mañana',
      company_id: companyA,
      address: {
        street: 'Av. Reforma',
        exterior_number: '10',
        interior_number: '3B',
        neighborhood: 'Juárez',
        city: 'CDMX',
        state: 'CDMX',
        postal_code: '06600',
        country: 'MX',
        text: null,
      },
      // 10 work tickets, one owes 60; the deleted one and B's are ignored.
      balance: { balance_due: 60, due_ticket_count: 1, ticket_count: 10 },
    });
    const docs = detail.recent_documents as Array<Record<string, unknown>>;
    expect(docs).toHaveLength(10);
    expect(docs[0]).toMatchObject({ document_kind: 'presupuesto', total: 100 });
    expect(docs.every((doc) => doc.total === 100)).toBe(true);
    expect(jest.mocked(assertAgentCompanyAccess)).toHaveBeenCalledWith(
      expect.objectContaining({ companyId: companyA }),
      companyA,
      'tickets.read',
    );
  });

  it('a client of another company, or a deleted one, is not_found', async () => {
    expectError(await callTool('get_client', { company_id: companyA, client_id: clientB }), 'not_found');
    expectError(await callTool('get_client', { company_id: companyB, client_id: clientA }), 'not_found');
    expectError(
      await callTool('get_client', { company_id: companyA, client_id: clientDeleted }),
      'not_found',
    );
  });

  it("another company's services and materials never show up", async () => {
    const services = ok(await callTool('list_services', { company_id: companyB }));
    expect((services.services as Array<{ name: string }>).map((row) => row.name)).toEqual([
      'Servicio de B',
    ]);
    const materials = ok(await callTool('list_materials', { company_id: companyB }));
    expect((materials.materials as Array<{ id: number }>).map((row) => row.id)).toEqual([
      ids.materials[3],
    ]);
    const aMaterials = await collect('list_materials', 'materials', { company_id: companyA });
    expect(aMaterials.map((row) => row.id)).not.toContain(ids.materials[3]);
  });

  it('a malformed cursor is a validation error', async () => {
    expectError(
      await callTool('list_clients', { company_id: companyA, cursor: 'garbage' }),
      'validation',
    );
    expect(() => decodeCursor('garbage')).toThrow();
  });
});
