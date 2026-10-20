/**
 * @jest-environment node
 *
 * search / fetch end to end (ZIG-I23-5): the real /api/mcp handler, real API
 * keys and the real allow-list and RBAC checks, on a local Postgres. Skipped
 * unless DATABASE_URL points at localhost (see src/test/mcp-db-fixtures.ts).
 */
// security.ts pulls in next-auth (ESM); the MCP path never reads the session.
jest.mock('@/lib/auth', () => ({ auth: jest.fn() }));

import { eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { POST } from '@/app/api/mcp/route';
import {
  apiKey,
  client,
  company,
  material,
  permission,
  role,
  rolePermission,
  service,
  serviceMaterial,
  servicesTickets,
  ticket,
  ticketLineMaterial,
  user,
} from '@/db/schema';
import { db } from '@/lib/db';
import { fetchOutputSchema, searchOutputSchema } from '@/lib/mcp/schemas';
import { generateAgentToken, hashAgentToken } from '@/lib/server/agent-token';
import {
  closeTestDbPool,
  describeWithLocalDb,
  readMcpJsonRpc,
} from '@/test/mcp-db-fixtures';
import openAiSchemas from '@/test/openai-knowledge-schemas.json';

const ORIGIN = 'http://localhost:3072';
const PROTOCOL_VERSION = '2025-06-18';

const openAiSearchOutput = z.fromJSONSchema(openAiSchemas.search.output as never);
const openAiFetchOutput = z.fromJSONSchema(openAiSchemas.fetch.output as never);

let nextId = 1;

type ToolCallResult = {
  content: Array<{ type: string; text: string }>;
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
};

const callTool = async (token: string, name: string, args: Record<string, unknown>) => {
  const response = await POST(
    new Request(`${ORIGIN}/api/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        'mcp-protocol-version': PROTOCOL_VERSION,
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: nextId++,
        method: 'tools/call',
        params: { name, arguments: args },
      }),
    }),
  );
  expect(response.status).toBe(200);
  return (await readMcpJsonRpc(response)).result as ToolCallResult;
};

/** OpenAI's contract: one text item whose JSON is the payload; we also send structuredContent. */
const payloadOf = (result: ToolCallResult) => {
  expect(result.content).toHaveLength(1);
  expect(result.content[0].type).toBe('text');
  const payload = JSON.parse(result.content[0].text);
  expect(result.structuredContent).toEqual(payload);
  return payload;
};

describeWithLocalDb('search and fetch (real handler, local Postgres)', () => {
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const companyIds: number[] = [];
  const userIds: bigint[] = [];
  const roleIds: number[] = [];
  const ticketIds: bigint[] = [];
  const ids = {
    companyA: 0,
    companyB: 0,
    clientA: 0,
    clientB: 0,
    serviceA: 0,
    materialA: 0,
    ticketA: 0n,
    quoteA: 0n,
    boilerA: 0n,
    deletedA: 0n,
    ticketB: 0n,
  };
  const tokens = { systemA: '', systemAB: '', tenantA: '', writeOnlyScopeless: '' };

  const createCompany = async (label: string, isSystem = false) => {
    const [row] = await db
      .insert(company)
      .values({
        name: `MCP search ${label} ${stamp}`,
        phone: '5550000000',
        email: `search-${label}-${stamp}@company.test.local`,
        street: 'x',
        exterior_number: '1',
        neighborhood: 'x',
        city: 'x',
        state: 'x',
        country: 'MX',
        postal_code: '00000',
        is_system: isSystem,
        status: 'ACTIVE',
      })
      .returning({ id: company.id });
    companyIds.push(row.id);
    return row.id;
  };

  const createUser = async (label: string, companyId: number, roleId: number | null = null) => {
    const [row] = await db
      .insert(user)
      .values({
        name: `MCP search ${label}`,
        email: `search-${label}-${stamp}@user.test.local`,
        password: 'not-a-login',
        company_id: companyId,
        role_id: roleId,
      })
      .returning({ id: user.id });
    userIds.push(row.id);
    return row.id;
  };

  const createKey = async (userId: bigint, allowed: number[], scopes = ['read']) => {
    const { token, keyPrefix } = generateAgentToken();
    await db.insert(apiKey).values({
      user_id: userId,
      name: `MCP search ${stamp}`,
      key_hash: hashAgentToken(token),
      key_prefix: keyPrefix,
      scopes,
      allowed_company_ids: allowed,
    });
    return token;
  };

  const createDoc = async (values: Partial<typeof ticket.$inferInsert> & { company_id: number }) => {
    const [row] = await db.insert(ticket).values(values).returning({ id: ticket.id });
    ticketIds.push(row.id);
    return row.id;
  };

  beforeAll(async () => {
    ids.companyA = await createCompany('a');
    ids.companyB = await createCompany('b');
    const systemCompany = await createCompany('system', true);

    // A tenant role that reads tickets and clients but not the catalog.
    const [tenantRole] = await db
      .insert(role)
      .values({ name: `Técnico ${stamp}`, company_id: ids.companyA })
      .returning({ id: role.id });
    roleIds.push(tenantRole.id);
    const permissions = await db
      .select({ id: permission.id, name: permission.name, company_id: permission.company_id })
      .from(permission)
      .where(inArray(permission.name, ['tickets.read', 'clients.read']));
    const globalPermissions = permissions.filter((row) => row.company_id == null);
    expect(globalPermissions.map((row) => row.name).sort()).toEqual([
      'clients.read',
      'tickets.read',
    ]);
    await db
      .insert(rolePermission)
      .values(globalPermissions.map((row) => ({ role_id: tenantRole.id, permission_id: row.id })));

    const systemUser = await createUser('system', systemCompany);
    const tenantUser = await createUser('tenant', ids.companyA, tenantRole.id);
    tokens.systemA = await createKey(systemUser, [ids.companyA]);
    tokens.systemAB = await createKey(systemUser, [ids.companyA, ids.companyB]);
    tokens.tenantA = await createKey(tenantUser, [ids.companyA]);
    tokens.writeOnlyScopeless = await createKey(systemUser, [ids.companyA], ['write']);

    const [clientA] = await db
      .insert(client)
      .values({
        name: 'Juan Pérez',
        phone: '55 1234 5678',
        email: 'juan@cliente.test',
        street: 'Av. Reforma',
        exterior_number: '10',
        city: 'CDMX',
        company_id: ids.companyA,
      })
      .returning({ id: client.id });
    ids.clientA = clientA.id;
    const [clientB] = await db
      .insert(client)
      .values({ name: 'Pedro Pérez', phone: '5598765432', company_id: ids.companyB })
      .returning({ id: client.id });
    ids.clientB = clientB.id;

    const [materialA] = await db
      .insert(material)
      .values({ company_id: ids.companyA, name: `Tubo de cobre ${stamp}`, unit: 'm', price: 50 })
      .returning({ id: material.id });
    ids.materialA = materialA.id;
    const [serviceA] = await db
      .insert(service)
      .values({
        name: 'Revisión de boiler Pérez',
        description: 'Mantenimiento preventivo',
        price: 450,
        company_id: ids.companyA,
      })
      .returning({ id: service.id });
    ids.serviceA = serviceA.id;
    await db
      .insert(serviceMaterial)
      .values({ service_id: serviceA.id, material_id: materialA.id, quantity: 2 });

    ids.ticketA = await createDoc({
      company_id: ids.companyA,
      client_id: clientA.id,
      client_name: 'Juan Pérez',
      client_tel: '5512345678',
      ticket_date: new Date('2026-10-01T15:00:00Z'),
      created_at: new Date('2026-10-01T15:00:00Z'),
      total: 1200,
      paid: 0,
      folio_number: 42,
      folio_prefix: 'R',
      work_notes: 'Cliente pide factura',
    });
    ids.quoteA = await createDoc({
      company_id: ids.companyA,
      document_kind: 'presupuesto',
      client_id: clientA.id,
      client_name: 'Juan Pérez',
      ticket_date: new Date('2026-10-02T15:00:00Z'),
      created_at: new Date('2026-10-02T15:00:00Z'),
      total: 800,
      folio_number: 3,
      folio_prefix: 'P',
    });
    ids.boilerA = await createDoc({
      company_id: ids.companyA,
      client_name: 'Ana Ruiz',
      ticket_date: new Date('2026-10-03T15:00:00Z'),
      created_at: new Date('2026-10-03T15:00:00Z'),
      total: 300,
      paid: 300,
      finished: true,
      folio_number: 43,
      folio_prefix: 'R',
    });
    const [line] = await db
      .insert(servicesTickets)
      .values({ ticket_id: ids.boilerA, name: 'Cambio de boiler', quantity: 1, price: 200 })
      .returning({ id: servicesTickets.id });
    await db.insert(ticketLineMaterial).values({
      services_tickets_id: line.id,
      name: 'Codo de cobre',
      unit: 'pza',
      quantity: 2,
      price: 50,
    });
    ids.deletedA = await createDoc({
      company_id: ids.companyA,
      client_name: 'Juan Pérez Borrado',
      total: 10,
      folio_number: 44,
      folio_prefix: 'R',
      deleted_at: new Date(),
    });
    ids.ticketB = await createDoc({
      company_id: ids.companyB,
      client_id: clientB.id,
      client_name: 'Pedro Pérez',
      ticket_date: new Date('2026-10-04T15:00:00Z'),
      created_at: new Date('2026-10-04T15:00:00Z'),
      total: 500,
      folio_number: 42,
      folio_prefix: 'R',
    });
  });

  afterAll(async () => {
    if (ticketIds.length > 0) {
      const lines = await db
        .select({ id: servicesTickets.id })
        .from(servicesTickets)
        .where(inArray(servicesTickets.ticket_id, ticketIds));
      if (lines.length > 0) {
        await db.delete(ticketLineMaterial).where(
          inArray(
            ticketLineMaterial.services_tickets_id,
            lines.map((row) => row.id),
          ),
        );
        await db.delete(servicesTickets).where(inArray(servicesTickets.ticket_id, ticketIds));
      }
      await db.delete(ticket).where(inArray(ticket.id, ticketIds));
    }
    if (ids.serviceA) {
      await db.delete(serviceMaterial).where(eq(serviceMaterial.service_id, ids.serviceA));
    }
    if (companyIds.length > 0) {
      await db.delete(service).where(inArray(service.company_id, companyIds));
      await db.delete(material).where(inArray(material.company_id, companyIds));
      await db.delete(client).where(inArray(client.company_id, companyIds));
    }
    if (userIds.length > 0) {
      await db.delete(apiKey).where(inArray(apiKey.user_id, userIds));
      await db.delete(user).where(inArray(user.id, userIds));
    }
    if (roleIds.length > 0) {
      await db.delete(rolePermission).where(inArray(rolePermission.role_id, roleIds));
      await db.delete(role).where(inArray(role.id, roleIds));
    }
    if (companyIds.length > 0) {
      await db.delete(company).where(inArray(company.id, companyIds));
    }
    await closeTestDbPool();
  });

  const search = async (token: string, args: Record<string, unknown>) => {
    const result = await callTool(token, 'search', args);
    expect(result.isError).toBeFalsy();
    const payload = payloadOf(result);
    expect(openAiSearchOutput.safeParse(payload).error).toBeUndefined();
    expect(searchOutputSchema.safeParse(payload).error).toBeUndefined();
    return payload.results as Array<{ id: string; title: string; url: string }>;
  };

  const fetchRecord = async (token: string, id: string) => {
    const result = await callTool(token, 'fetch', { id });
    expect(result.isError).toBeFalsy();
    const payload = payloadOf(result);
    expect(openAiFetchOutput.safeParse(payload).error).toBeUndefined();
    expect(fetchOutputSchema.safeParse(payload).error).toBeUndefined();
    return payload as {
      id: string;
      title: string;
      text: string;
      url: string;
      metadata: Record<string, unknown>;
    };
  };

  const expectNotFound = async (token: string, id: string) => {
    const result = await callTool(token, 'fetch', { id });
    expect(result.isError).toBe(true);
    expect(payloadOf(result).error).toMatchObject({ code: 'not_found' });
  };

  describe('search', () => {
    it("'Pérez' returns the documents, the client and the service with id, title and absolute url", async () => {
      const results = await search(tokens.systemA, { query: 'Pérez' });
      const byId = new Map(results.map((row) => [row.id, row]));

      expect(byId.get(`doc:${ids.ticketA}`)).toEqual({
        id: `doc:${ids.ticketA}`,
        title: 'R-0042 · Juan Pérez · $1,200 · Pendiente',
        url: `${ORIGIN}/tickets/${ids.ticketA}`,
      });
      expect(byId.get(`doc:${ids.quoteA}`)).toEqual({
        id: `doc:${ids.quoteA}`,
        title: 'P-0003 · Juan Pérez · $800 · Presupuesto abierto',
        url: `${ORIGIN}/presupuestos/${ids.quoteA}`,
      });
      expect(byId.get(`client:${ids.clientA}`)).toEqual({
        id: `client:${ids.clientA}`,
        title: 'Cliente · Juan Pérez',
        url: `${ORIGIN}/clients/${ids.clientA}`,
      });
      expect(byId.get(`service:${ids.serviceA}`)).toEqual({
        id: `service:${ids.serviceA}`,
        title: 'Servicio · Revisión de boiler Pérez · $450',
        url: `${ORIGIN}/services/${ids.serviceA}/edit`,
      });
      for (const row of results) expect(row.url.startsWith(`${ORIGIN}/`)).toBe(true);
    });

    it('a company outside the allow-list contributes nothing; allow-listing it brings it in', async () => {
      const onlyA = (await search(tokens.systemA, { query: 'Pérez' })).map((row) => row.id);
      expect(onlyA).not.toContain(`doc:${ids.ticketB}`);
      expect(onlyA).not.toContain(`client:${ids.clientB}`);

      const both = (await search(tokens.systemAB, { query: 'Pérez' })).map((row) => row.id);
      expect(both).toEqual(expect.arrayContaining([`doc:${ids.ticketB}`, `client:${ids.clientB}`]));

      const scoped = (
        await search(tokens.systemAB, { query: 'Pérez', company_id: ids.companyB })
      ).map((row) => row.id);
      expect(scoped.sort()).toEqual([`client:${ids.clientB}`, `doc:${ids.ticketB}`].sort());
    });

    it('company_id outside the allow-list is forbidden', async () => {
      const result = await callTool(tokens.systemA, 'search', {
        query: 'Pérez',
        company_id: ids.companyB,
      });
      expect(result.isError).toBe(true);
      expect(payloadOf(result).error).toMatchObject({ code: 'forbidden' });
    });

    it('never returns soft-deleted rows', async () => {
      const results = await search(tokens.systemA, { query: 'Borrado' });
      expect(results.map((row) => row.id)).not.toContain(`doc:${ids.deletedA}`);
    });

    it('a kind the role may not read is skipped (no services.read for the tenant)', async () => {
      const ids_ = (await search(tokens.tenantA, { query: 'Pérez' })).map((row) => row.id);
      expect(ids_).toEqual(
        expect.arrayContaining([`doc:${ids.ticketA}`, `client:${ids.clientA}`]),
      );
      expect(ids_.some((id) => id.startsWith('service:'))).toBe(false);
    });

    it('matches folio first, then phone, line names, materials and work notes', async () => {
      const folio = await search(tokens.systemAB, { query: 'R-0042' });
      expect(folio.map((row) => row.id).slice(0, 2).sort()).toEqual(
        [`doc:${ids.ticketA}`, `doc:${ids.ticketB}`].sort(),
      );

      const phone = (await search(tokens.systemA, { query: '55 1234 5678' })).map((row) => row.id);
      expect(phone).toEqual(expect.arrayContaining([`doc:${ids.ticketA}`, `client:${ids.clientA}`]));

      const line = (await search(tokens.systemA, { query: 'cambio de boiler' })).map((row) => row.id);
      expect(line).toEqual([`doc:${ids.boilerA}`]);

      const materialHit = (await search(tokens.systemA, { query: 'codo de cobre' })).map((row) => row.id);
      expect(materialHit).toEqual([`doc:${ids.boilerA}`]);

      const notes = (await search(tokens.systemA, { query: 'factura' })).map((row) => row.id);
      expect(notes).toEqual([`doc:${ids.ticketA}`]);

      const serviceByMaterial = (
        await search(tokens.systemA, { query: `Tubo de cobre ${stamp}` })
      ).map((row) => row.id);
      expect(serviceByMaterial).toEqual([`service:${ids.serviceA}`]);
    });

    it('needs the read scope', async () => {
      const result = await callTool(tokens.writeOnlyScopeless, 'search', { query: 'Pérez' });
      expect(result.isError).toBe(true);
      expect(payloadOf(result).error).toMatchObject({ code: 'forbidden' });
    });
  });

  describe('fetch', () => {
    it('a ticket: readable text with client, lines, materials, totals, balance and notes', async () => {
      const record = await fetchRecord(tokens.systemA, `doc:${ids.boilerA}`);
      expect(record).toMatchObject({
        id: `doc:${ids.boilerA}`,
        title: 'R-0043 · Ana Ruiz · $300 · Pagado',
        url: `${ORIGIN}/tickets/${ids.boilerA}`,
        metadata: {
          kind: 'ticket',
          company_id: ids.companyA,
          folio: 'R-0043',
          payment_status: 'pagado',
          total: 300,
          balance: 0,
          date: '2026-10-03',
        },
      });
      expect(record.text).toContain('Ticket R-0043 (Pagado, terminado)');
      expect(record.text).toContain('Cliente: Ana Ruiz');
      expect(record.text).toContain('- Cambio de boiler: 1 × $200 = $300');
      expect(record.text).toContain('  · Codo de cobre: 2 pza × $50');
      expect(record.text).toContain('Total: $300 · Pagado: $300 · Saldo: $0');
    });

    it('a presupuesto and a ticket with notes and client contact', async () => {
      const quote = await fetchRecord(tokens.systemA, `doc:${ids.quoteA}`);
      expect(quote.metadata).toMatchObject({ kind: 'presupuesto', presupuesto_status: 'abierto' });
      expect(quote.url).toBe(`${ORIGIN}/presupuestos/${ids.quoteA}`);

      const record = await fetchRecord(tokens.systemA, `doc:${ids.ticketA}`);
      expect(record.text).toContain('Tel. 5512345678');
      expect(record.text).toContain('juan@cliente.test');
      expect(record.text).toContain('Dirección: Av. Reforma #10, CDMX');
      expect(record.text).toContain('Notas de trabajo: Cliente pide factura');
      expect(record.metadata).toMatchObject({ balance: 1200, payment_status: 'pendiente' });
    });

    it('a client: contact, balance and recent documents', async () => {
      const record = await fetchRecord(tokens.systemA, `client:${ids.clientA}`);
      expect(record).toMatchObject({
        id: `client:${ids.clientA}`,
        title: 'Cliente · Juan Pérez',
        url: `${ORIGIN}/clients/${ids.clientA}`,
        metadata: { kind: 'client', company_id: ids.companyA, phone: '55 1234 5678' },
      });
      expect(record.text).toContain('Teléfono: 55 1234 5678');
      expect(record.text).toContain('- R-0042 · Juan Pérez · $1,200 · Pendiente (2026-10-01)');
      expect(record.text).toContain('- P-0003 · Juan Pérez · $800 · Presupuesto abierto');
    });

    it('a service: price and default materials', async () => {
      const record = await fetchRecord(tokens.systemA, `service:${ids.serviceA}`);
      expect(record).toMatchObject({
        id: `service:${ids.serviceA}`,
        url: `${ORIGIN}/services/${ids.serviceA}/edit`,
        metadata: { kind: 'service', price: 450, default_material_count: 1 },
      });
      expect(record.text).toContain(`- Tubo de cobre ${stamp}: 2 m × $50`);
    });

    it('a foreign, deleted, unreadable or malformed id is not_found', async () => {
      await expectNotFound(tokens.systemA, `doc:${ids.ticketB}`);
      await expectNotFound(tokens.systemA, `client:${ids.clientB}`);
      await expectNotFound(tokens.systemA, `doc:${ids.deletedA}`);
      await expectNotFound(tokens.tenantA, `service:${ids.serviceA}`);
      await expectNotFound(tokens.systemA, 'doc:999999999999');
      await expectNotFound(tokens.systemA, 'R-0042');
      await expectNotFound(tokens.systemA, `client:99999999999`);
      // Allow-listed, the same id reads fine.
      const record = await fetchRecord(tokens.systemAB, `doc:${ids.ticketB}`);
      expect(record.metadata.company_id).toBe(ids.companyB);
    });
  });
});
