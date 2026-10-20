/**
 * @jest-environment node
 *
 * Prompts and resources through the real /api/mcp handler against a local
 * Postgres (ZIG-I23-10): real API keys, allow-lists and role permissions.
 * Skipped unless DATABASE_URL points at localhost (see src/test/mcp-db-fixtures.ts):
 *   DATABASE_URL=postgresql://…@localhost:5433/<scratch copy> npx jest src/lib/mcp/resources.db.test.ts
 */
// security.ts pulls in next-auth (ESM); the MCP path never reads the session.
jest.mock('@/lib/auth', () => ({ auth: jest.fn() }));

import { and, eq, inArray, isNull } from 'drizzle-orm';
import { POST } from '@/app/api/mcp/route';
import {
  apiKey,
  company,
  material,
  permission,
  role,
  rolePermission,
  service,
  serviceMaterial,
  user,
} from '@/db/schema';
import { db } from '@/lib/db';
import { MCP_PROMPT_NAMES } from '@/lib/mcp/prompts';
import { generateAgentToken, hashAgentToken } from '@/lib/server/agent-token';
import {
  closeTestDbPool,
  describeWithLocalDb,
  readMcpJsonRpc,
} from '@/test/mcp-db-fixtures';

// The first request compiles the whole route; seeding plus that can pass 5 s.
jest.setTimeout(30_000);

const ORIGIN = 'http://localhost:3072';
const PROTOCOL_VERSION = '2025-06-18';

let nextId = 1;

const rpc = async (method: string, params: Record<string, unknown>, token: string) => {
  const response = await POST(
    new Request(`${ORIGIN}/api/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        'mcp-protocol-version': PROTOCOL_VERSION,
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: nextId++, method, params }),
    }),
  );
  expect(response.status).toBe(200);
  return readMcpJsonRpc(response) as Promise<{
    result?: Record<string, unknown>;
    error?: { code: number; message: string };
  }>;
};

type ListedResource = { uri: string; name: string; title?: string; mimeType?: string };

describeWithLocalDb('MCP prompts and resources (real handler, local Postgres)', () => {
  const stamp = `res-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const ids = {
    companies: [] as number[],
    users: [] as bigint[],
    roles: [] as number[],
    services: [] as number[],
    materials: [] as number[],
  };
  let companyA: number;
  let companyB: number;
  let companyC: number;
  let tokenFull: string;
  let tokenProfileOnly: string;
  let tokenSystem: string;
  let materialA: number;

  const createCompany = async (label: string, settings: Record<string, string> | null = null) => {
    const [row] = await db
      .insert(company)
      .values({
        name: `MCP ${label} ${stamp}`,
        phone: '5551112222',
        email: `${label}-${stamp}@company.test.local`,
        street: 'Av. Juárez',
        exterior_number: '100',
        interior_number: label === 'a' ? '2' : null,
        neighborhood: 'Centro',
        city: 'Puebla',
        state: 'Puebla',
        country: 'MX',
        postal_code: '72000',
        settings,
      })
      .returning({ id: company.id });
    ids.companies.push(row.id);
    return row.id;
  };

  const createRole = async (companyId: number, permissionNames: string[]) => {
    const [roleRow] = await db
      .insert(role)
      .values({ name: `MCP role ${permissionNames.join('+')} ${stamp}`, company_id: companyId })
      .returning({ id: role.id });
    ids.roles.push(roleRow.id);
    const permissionRows = await db
      .select({ id: permission.id })
      .from(permission)
      .where(
        and(
          inArray(permission.name, permissionNames),
          isNull(permission.company_id),
          isNull(permission.deleted_at),
        ),
      );
    expect(permissionRows).toHaveLength(permissionNames.length);
    await db
      .insert(rolePermission)
      .values(permissionRows.map((row) => ({ role_id: roleRow.id, permission_id: row.id })));
    return roleRow.id;
  };

  const createUserWithKey = async (
    label: string,
    companyId: number,
    roleId: number | null,
    allowedCompanyIds: number[],
  ) => {
    const [userRow] = await db
      .insert(user)
      .values({
        name: `MCP ${label} ${stamp}`,
        email: `${label}-${stamp}@user.test.local`,
        password: 'not-a-login',
        company_id: companyId,
        role_id: roleId,
      })
      .returning({ id: user.id });
    ids.users.push(userRow.id);
    const { token, keyPrefix } = generateAgentToken();
    await db.insert(apiKey).values({
      user_id: userRow.id,
      name: `MCP ${label} ${stamp}`,
      key_hash: hashAgentToken(token),
      key_prefix: keyPrefix,
      scopes: ['read'],
      allowed_company_ids: allowedCompanyIds,
    });
    return token;
  };

  beforeAll(async () => {
    companyA = await createCompany('a', {
      payment_bank: 'BBVA',
      payment_holder: 'Climas A',
      payment_clabe: '012180001234567897',
      folio_prefix_ticket: 'ta',
    });
    companyB = await createCompany('b');
    companyC = await createCompany('c');

    const systemCompany = await db.query.company.findFirst({
      where: and(eq(company.is_system, true), isNull(company.deleted_at)),
      columns: { id: true },
    });
    expect(systemCompany).toBeDefined();

    const fullRole = await createRole(companyA, ['tickets.read', 'services.read']);
    const profileRole = await createRole(companyA, ['tickets.read']);
    // A tenant user only ever reaches its own company, even if B is allow-listed.
    tokenFull = await createUserWithKey('full', companyA, fullRole, [companyA, companyB]);
    tokenProfileOnly = await createUserWithKey('profile', companyA, profileRole, [companyA]);
    // A system user reaches every company, so the allow-list alone decides.
    tokenSystem = await createUserWithKey('system', systemCompany!.id, null, [companyA, companyB]);

    const materials = await db
      .insert(material)
      .values([
        { company_id: companyA, name: `Gas R410 ${stamp}`, unit: 'kg', price: 300 },
        { company_id: companyB, name: `Material B ${stamp}`, unit: 'pza', price: 1 },
      ])
      .returning({ id: material.id });
    ids.materials.push(...materials.map((row) => row.id));
    materialA = materials[0].id;

    const services = await db
      .insert(service)
      .values([
        { name: 'Mantenimiento', description: 'Limpieza de minisplit', price: 650, company_id: companyA },
        { name: 'Servicio de B', description: 'x', price: 1, company_id: companyB },
      ])
      .returning({ id: service.id });
    ids.services.push(...services.map((row) => row.id));
    await db.insert(serviceMaterial).values([
      { service_id: services[0].id, material_id: materialA, quantity: 0.5, price: 320 },
      { service_id: services[1].id, material_id: materials[1].id, quantity: 1 },
    ]);
  });

  afterAll(async () => {
    if (ids.services.length > 0) {
      await db.delete(serviceMaterial).where(inArray(serviceMaterial.service_id, ids.services));
      await db.delete(service).where(inArray(service.id, ids.services));
    }
    if (ids.materials.length > 0) {
      await db.delete(material).where(inArray(material.id, ids.materials));
    }
    if (ids.users.length > 0) {
      await db.delete(apiKey).where(inArray(apiKey.user_id, ids.users));
      await db.delete(user).where(inArray(user.id, ids.users));
    }
    if (ids.roles.length > 0) {
      await db.delete(rolePermission).where(inArray(rolePermission.role_id, ids.roles));
      await db.delete(role).where(inArray(role.id, ids.roles));
    }
    if (ids.companies.length > 0) {
      await db.delete(company).where(inArray(company.id, ids.companies));
    }
    await closeTestDbPool();
  });

  const listUris = async (token: string) => {
    const { result, error } = await rpc('resources/list', {}, token);
    expect(error).toBeUndefined();
    return ((result!.resources as ListedResource[]) ?? []).map((resource) => resource.uri).sort();
  };

  const readJson = async (uri: string, token: string) => {
    const { result, error } = await rpc('resources/read', { uri }, token);
    expect(error).toBeUndefined();
    const contents = result!.contents as Array<{ uri: string; mimeType: string; text: string }>;
    expect(contents).toHaveLength(1);
    expect(contents[0]).toMatchObject({ uri, mimeType: 'application/json' });
    return JSON.parse(contents[0].text);
  };

  const readError = async (uri: string, token: string) => {
    const { result, error } = await rpc('resources/read', { uri }, token);
    expect(result).toBeUndefined();
    expect(error).toBeDefined();
    return error!;
  };

  it('initialize declares prompts and resources and the instructions mention them', async () => {
    const { result } = await rpc(
      'initialize',
      {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: {},
        clientInfo: { name: 'jest', version: '1.0.0' },
      },
      tokenFull,
    );
    const capabilities = result!.capabilities as Record<string, unknown>;
    expect(capabilities.prompts).toBeDefined();
    expect(capabilities.resources).toBeDefined();
    expect(result!.instructions).toContain('cobranza_de_hoy');
    expect(result!.instructions).toContain('zigzag://company/<id>/catalog');

    const prompts = await rpc('prompts/list', {}, tokenFull);
    expect(
      (prompts.result!.prompts as Array<{ name: string }>).map((prompt) => prompt.name).sort(),
    ).toEqual([...MCP_PROMPT_NAMES].sort());
  });

  it('resources/list only lists allow-listed companies the user can access', async () => {
    expect(await listUris(tokenFull)).toEqual(
      [`zigzag://company/${companyA}/catalog`, `zigzag://company/${companyA}/profile`].sort(),
    );
    const systemUris = await listUris(tokenSystem);
    expect(systemUris).toEqual(
      [
        `zigzag://company/${companyA}/catalog`,
        `zigzag://company/${companyA}/profile`,
        `zigzag://company/${companyB}/catalog`,
        `zigzag://company/${companyB}/profile`,
      ].sort(),
    );
    expect(systemUris.join(' ')).not.toContain(`company/${companyC}/`);
  });

  it('resources/list leaves out the catalog when the role lacks services.read', async () => {
    expect(await listUris(tokenProfileOnly)).toEqual([`zigzag://company/${companyA}/profile`]);
  });

  it('resources/read returns the company profile', async () => {
    const profile = await readJson(`zigzag://company/${companyA}/profile`, tokenFull);
    expect(profile).toEqual({
      id: companyA,
      name: `MCP a ${stamp}`,
      phone: '5551112222',
      email: `a-${stamp}@company.test.local`,
      address: {
        street: 'Av. Juárez',
        exterior_number: '100',
        interior_number: '2',
        neighborhood: 'Centro',
        city: 'Puebla',
        state: 'Puebla',
        postal_code: '72000',
        country: 'MX',
      },
      payment_info: {
        bank: 'BBVA',
        holder: 'Climas A',
        clabe: '012180001234567897',
        note: null,
      },
      folio_prefixes: { ticket: 'TA', presupuesto: 'P' },
    });
  });

  it('resources/read returns the catalog with default materials, scoped to the company', async () => {
    const catalog = await readJson(`zigzag://company/${companyA}/catalog`, tokenFull);
    expect(catalog).toEqual({
      company_id: companyA,
      truncated: false,
      services: [
        {
          id: ids.services[0],
          name: 'Mantenimiento',
          description: 'Limpieza de minisplit',
          price: 650,
          default_materials: [
            { material_id: materialA, name: `Gas R410 ${stamp}`, quantity: 0.5, unit: 'kg', price: 320 },
          ],
        },
      ],
    });
  });

  it('resources/read refuses companies outside the allow-list or the user’s reach', async () => {
    const outside = await readError(`zigzag://company/${companyC}/profile`, tokenSystem);
    expect(outside.message).toContain('Compañía no autorizada para esta conexión');
    const notReachable = await readError(`zigzag://company/${companyB}/catalog`, tokenFull);
    expect(notReachable.message).toContain('Sin acceso a esta compañía');
    const noPermission = await readError(`zigzag://company/${companyA}/catalog`, tokenProfileOnly);
    expect(noPermission.message).toContain('services.read');
    await readError('zigzag://company/abc/profile', tokenFull);
  });
});
