/** @jest-environment node */
import { InMemoryTransport, McpServer } from '@modelcontextprotocol/server';
import type { z } from 'zod';
import {
  createAgentTicket,
  getAgentIdentity,
  getAgentTicket,
  listAgentCompanies,
  listAgentTickets,
  updateAgentTicketStatus,
} from '@/lib/mcp/domain';
import { listAgentMaterials, listAgentServices } from '@/lib/mcp/domain/catalog';
import { getAgentClient, listAgentClients } from '@/lib/mcp/domain/clients';
import { registerMcpTools } from '@/lib/mcp/register-tools';
import {
  errorSchema,
  getClientOutputSchema,
  getTicketOutputSchema,
  listClientsOutputSchema,
  listCompaniesOutputSchema,
  listMaterialsOutputSchema,
  listServicesOutputSchema,
  listTicketsOutputSchema,
  ticketWriteOutputSchema,
  whoamiSchema,
} from '@/lib/mcp/schemas';
import { mapAgentTicketDetail, mapAgentTicketSummary } from '@/lib/mcp/serialize-ticket';
import {
  AgentAuthError,
  resolveAgentContext,
  resolveAgentUser,
} from '@/lib/server/resolve-agent-context';

jest.mock('@/lib/logger', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}));

jest.mock('@/lib/rate-limiter', () => ({
  checkRateLimit: jest.fn().mockResolvedValue(true),
}));

// Document tools (ZIG-I23-3) have their own suite in tools/documents.test.ts.
// search/fetch run end to end in tools/search.db.test.ts.
jest.mock('@/lib/mcp/domain/search', () => ({
  fetchKnowledge: jest.fn(),
  searchKnowledge: jest.fn(),
}));

jest.mock('@/lib/mcp/domain/documents', () => ({
  getAgentCompanySummary: jest.fn(),
  getAgentDocument: jest.fn(),
  listAgentDocuments: jest.fn(),
}));

jest.mock('@/lib/mcp/domain', () => ({
  createAgentTicket: jest.fn(),
  getAgentIdentity: jest.fn(),
  getAgentTicket: jest.fn(),
  listAgentCompanies: jest.fn(),
  listAgentTickets: jest.fn(),
  updateAgentTicketStatus: jest.fn(),
}));

jest.mock('@/lib/mcp/domain/catalog', () => ({
  listAgentMaterials: jest.fn(),
  listAgentServices: jest.fn(),
}));

jest.mock('@/lib/mcp/domain/clients', () => ({
  getAgentClient: jest.fn(),
  listAgentClients: jest.fn(),
}));

// The in-memory transport carries no HTTP request, so the bearer header is
// null; the resolvers are mocked and parseBearerToken just passes it through.
jest.mock('@/lib/server/resolve-agent-context', () => {
  class MockAgentAuthError extends Error {
    readonly status: number;
    constructor(message: string, status: number) {
      super(message);
      this.name = 'AgentAuthError';
      this.status = status;
    }
  }
  return {
    AgentAuthError: MockAgentAuthError,
    parseBearerToken: jest.fn(() => 'zz_test'),
    resolveAgentContext: jest.fn(),
    resolveAgentUser: jest.fn(),
    assertAgentCompanyAccess: jest.fn().mockResolvedValue(undefined),
    assertScope: jest.fn((agent: { scopes: string[] }, scope: string) => {
      if (!agent.scopes.includes(scope)) {
        throw new MockAgentAuthError(`El token no tiene el scope "${scope}"`, 403);
      }
    }),
  };
});

const agentUser = {
  userId: 5n,
  scopes: ['read' as const, 'write' as const],
  allowedCompanyIds: [7],
  authSource: 'oauth_grant' as const,
  oauthGrantId: 11,
  rateLimitIdentity: -11,
};

const ticketRow = {
  id: 9001n,
  client_id: 42,
  client_name: 'Sample Client',
  ticket_date: new Date('2026-01-15T10:00:00.000Z'),
  total: 150.5,
  paid: 0,
  finished: false,
  company_id: 7,
  created_at: new Date('2026-01-15T10:00:00.000Z'),
};

const companies = [{ id: 7, name: 'Taller Uno', status: 'ACTIVE' as const }];

type RpcResponse = {
  id: number;
  result?: Record<string, unknown>;
  error?: { code: number; message: string };
};

type ToolDefinition = {
  name: string;
  description?: string;
  annotations?: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  _meta?: Record<string, unknown>;
};

type CallResult = {
  content: Array<{ type: string; text: string }>;
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
};

let client: InMemoryTransport;
let nextId = 1;
const pending = new Map<number, (message: RpcResponse) => void>();

const rpc = (method: string, params: Record<string, unknown> = {}) =>
  new Promise<RpcResponse>((resolve) => {
    const id = nextId++;
    pending.set(id, resolve);
    void client.send({ jsonrpc: '2.0', id, method, params });
  });

const callTool = async (name: string, args: Record<string, unknown> = {}) => {
  const response = await rpc('tools/call', { name, arguments: args });
  expect(response.error).toBeUndefined();
  return response.result as CallResult;
};

beforeAll(async () => {
  const server = new McpServer(
    { name: 'zigzag', version: '2.0.0' },
    { capabilities: { tools: { listChanged: true } } },
  );
  registerMcpTools(server);

  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  client = clientSide;
  client.onmessage = (message) => {
    const response = message as unknown as RpcResponse;
    const resolve = pending.get(response.id);
    if (resolve) {
      pending.delete(response.id);
      resolve(response);
    }
  };
  await server.connect(serverSide);
  await client.start();

  const init = await rpc('initialize', {
    protocolVersion: '2025-06-18',
    capabilities: {},
    clientInfo: { name: 'jest', version: '0.0.0' },
  });
  expect(init.error).toBeUndefined();
  await client.send({ jsonrpc: '2.0', method: 'notifications/initialized' });
});

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(resolveAgentUser).mockResolvedValue(agentUser);
  jest
    .mocked(resolveAgentContext)
    .mockImplementation(async (_header, companyId) => ({ ...agentUser, companyId }));
  jest.mocked(listAgentCompanies).mockResolvedValue(companies);
  jest.mocked(getAgentIdentity).mockResolvedValue({
    user: { id: '5', name: 'Jorge' },
    connectionLabel: 'ChatGPT',
  });
  jest.mocked(listAgentTickets).mockResolvedValue([mapAgentTicketSummary(ticketRow)]);
  jest.mocked(getAgentTicket).mockResolvedValue(
    mapAgentTicketDetail({
      ...ticketRow,
      services_tickets: [
        { id: 1, service_id: 3, quantity: 2, price: 50 },
        {
          id: 2,
          service_id: null,
          name: 'Mano de obra',
          quantity: 1,
          price: 50.5,
          materials: [{ name: 'Tornillo', unit: 'pza', quantity: 4, price: 2.5 }],
        },
      ],
    }),
  );
  jest.mocked(createAgentTicket).mockResolvedValue(mapAgentTicketSummary(ticketRow));
  jest
    .mocked(updateAgentTicketStatus)
    .mockResolvedValue(mapAgentTicketSummary({ ...ticketRow, finished: true }));
  jest.mocked(listAgentClients).mockResolvedValue({
    clients: [
    {
      id: 42,
      name: 'Sample Client',
      email: null,
      document: 'RFC123',
      company_id: 7,
      created_at: new Date('2026-01-10T08:00:00.000Z'),
    },
    ],
    next_cursor: null,
  });
  jest.mocked(listAgentServices).mockResolvedValue({
    services: [
      {
        id: 3,
        name: 'Mantenimiento',
        description: 'Limpieza de minisplit',
        price: 650,
        default_materials: [
          { material_id: 8, name: 'Gas R410', quantity: 0.5, unit: 'kg', price: 320 },
        ],
      },
    ],
    next_cursor: 'MjAyNi0wMS0xMFQwODowMDowMC4wMDBaLDM',
  });
  jest.mocked(listAgentMaterials).mockResolvedValue({
    materials: [{ id: 8, name: 'Gas R410', unit: 'kg', price: 300 }],
    next_cursor: null,
  });
  jest.mocked(getAgentClient).mockResolvedValue({
    id: 42,
    name: 'Sample Client',
    document: 'RFC123',
    notes: null,
    phone: '5512345678',
    email: null,
    address: {
      street: 'Av. Uno',
      exterior_number: '10',
      interior_number: null,
      neighborhood: 'Centro',
      city: 'CDMX',
      state: 'CDMX',
      postal_code: '06000',
      country: 'MX',
      text: null,
    },
    balance: { balance_due: 150.5, due_ticket_count: 1, ticket_count: 1 },
    recent_documents: [
      {
        id: '9001',
        client_id: 42,
        client_name: 'Sample Client',
        ticket_date: new Date('2026-01-15T10:00:00.000Z'),
        total: 150.5,
        paid: 0,
        finished: true,
        company_id: 7,
        created_at: new Date('2026-01-15T10:00:00.000Z'),
        kind: 'ticket' as const,
        folio: { prefix: 'R', number: 1, label: 'R-0001' },
        payment_status: 'pendiente' as const,
        balance: 150.5,
        presupuesto_status: null,
        updated_at: null,
      },
    ],
    company_id: 7,
    created_at: new Date('2026-01-10T08:00:00.000Z'),
  });
});

const WRITE_TOOLS = new Set(['create_ticket', 'update_ticket_status']);

describe('tools/list', () => {
  let tools: ToolDefinition[];

  beforeAll(async () => {
    const response = await rpc('tools/list');
    tools = (response.result as { tools: ToolDefinition[] }).tools;
  });

  it('lists whoami, the six v1 tools, the catalog, document and search tools', () => {
    expect(tools.map((tool) => tool.name).sort()).toEqual(
      [
        'create_ticket',
        'fetch',
        'get_client',
        'get_company_summary',
        'get_document',
        'get_ticket',
        'list_documents',
        'list_clients',
        'list_materials',
        'list_services',
        'list_companies',
        'list_tickets',
        'search',
        'update_ticket_status',
        'whoami',
      ].sort(),
    );
  });

  it('every tool declares an object outputSchema and all four annotations', () => {
    for (const tool of tools) {
      expect(tool.outputSchema).toMatchObject({ type: 'object' });
      expect(tool.annotations).toEqual({
        readOnlyHint: expect.any(Boolean),
        destructiveHint: expect.any(Boolean),
        idempotentHint: expect.any(Boolean),
        openWorldHint: false,
      });
    }
  });

  it('no writing tool claims readOnlyHint, and reads are read-only', () => {
    for (const tool of tools) {
      expect(tool.annotations?.readOnlyHint).toBe(!WRITE_TOOLS.has(tool.name));
    }
  });

  it('create_ticket is not idempotent; update_ticket_status is idempotent and not destructive', () => {
    const byName = Object.fromEntries(tools.map((tool) => [tool.name, tool]));
    expect(byName.create_ticket.annotations).toMatchObject({
      destructiveHint: false,
      idempotentHint: false,
    });
    expect(byName.update_ticket_status.annotations).toMatchObject({
      destructiveHint: false,
      idempotentHint: true,
    });
  });

  it('list_tickets and get_ticket say they are deprecated and point to the document tools', () => {
    const byName = Object.fromEntries(tools.map((tool) => [tool.name, tool]));
    expect(byName.list_tickets.description).toMatch(/deprecated/);
    expect(byName.list_tickets.description).toContain('list_documents');
    expect(byName.get_ticket.description).toMatch(/deprecated/);
    expect(byName.get_ticket.description).toContain('get_document');
  });

  it("whoami carries _meta['openai/profile'] = true", () => {
    const whoami = tools.find((tool) => tool.name === 'whoami');
    expect(whoami?._meta).toEqual({ 'openai/profile': true });
  });
});

describe('tools/call', () => {
  const cases: Array<[string, Record<string, unknown>, z.ZodType]> = [
    ['whoami', {}, whoamiSchema],
    ['list_companies', {}, listCompaniesOutputSchema],
    ['list_tickets', { company_id: 7 }, listTicketsOutputSchema],
    ['get_ticket', { company_id: 7, ticket_id: '9001' }, getTicketOutputSchema],
    [
      'create_ticket',
      { company_id: 7, client_name: 'Ana', client_tel: '5512345678' },
      ticketWriteOutputSchema,
    ],
    [
      'update_ticket_status',
      { company_id: 7, ticket_id: 9001, finished: true },
      ticketWriteOutputSchema,
    ],
    ['list_clients', { company_id: 7 }, listClientsOutputSchema],
    ['list_services', { company_id: 7, query: 'mini' }, listServicesOutputSchema],
    ['list_materials', { company_id: 7 }, listMaterialsOutputSchema],
    ['get_client', { company_id: 7, client_id: 42 }, getClientOutputSchema],
  ];

  it.each(cases)(
    '%s returns structuredContent valid against its outputSchema plus identical text',
    async (name, args, schema) => {
      const result = await callTool(name, args);
      expect(result.isError).toBeUndefined();
      expect(result.structuredContent).toBeDefined();
      expect(schema.safeParse(result.structuredContent).error).toBeUndefined();
      const text = result.content.find((block) => block.type === 'text');
      expect(JSON.parse(text!.text)).toEqual(result.structuredContent);
    },
  );

  it('whoami returns user, auth_source, scopes and allow-listed companies', async () => {
    const result = await callTool('whoami');
    expect(result.structuredContent).toEqual({
      user: { id: '5', name: 'Jorge' },
      auth_source: 'oauth_grant',
      connection_label: 'ChatGPT',
      scopes: ['read', 'write'],
      companies,
    });
  });

  it('whoami still answers when the connection has no companies', async () => {
    jest
      .mocked(resolveAgentUser)
      .mockResolvedValue({ ...agentUser, allowedCompanyIds: [] });
    jest.mocked(listAgentCompanies).mockResolvedValue([]);
    const result = await callTool('whoami');
    expect(result.isError).toBeUndefined();
    expect(result.structuredContent).toMatchObject({ companies: [] });
  });

  it('list_tickets and get_ticket keep the v1 shape (no document fields)', async () => {
    const v1Keys = [
      'client_id',
      'client_name',
      'company_id',
      'created_at',
      'finished',
      'id',
      'paid',
      'ticket_date',
      'total',
    ];
    const list = await callTool('list_tickets', { company_id: 7 });
    const [first] = (list.structuredContent as { tickets: Array<Record<string, unknown>> })
      .tickets;
    expect(Object.keys(first).sort()).toEqual(v1Keys);
    const detail = await callTool('get_ticket', { company_id: 7, ticket_id: '9001' });
    const ticket = (detail.structuredContent as { ticket: Record<string, unknown> }).ticket;
    expect(Object.keys(ticket).sort()).toEqual([...v1Keys, 'services_tickets'].sort());
  });

  it('serialises ids as strings and dates as ISO', async () => {
    const result = await callTool('get_ticket', { company_id: 7, ticket_id: '9001' });
    expect(result.structuredContent).toMatchObject({
      ticket: {
        id: '9001',
        created_at: '2026-01-15T10:00:00.000Z',
        total: 150.5,
        services_tickets: [
          { id: 1, service_id: 3 },
          { id: 2, service_id: null, name: 'Mano de obra' },
        ],
      },
    });
  });
});

describe('error paths', () => {
  const expectError = (result: CallResult, code: string) => {
    expect(result.isError).toBe(true);
    expect(errorSchema.safeParse(result.structuredContent).success).toBe(true);
    expect(result.structuredContent).toMatchObject({ error: { code } });
    expect(JSON.parse(result.content[0].text)).toEqual(result.structuredContent);
  };

  it('unauthorized when the token does not resolve', async () => {
    jest
      .mocked(resolveAgentUser)
      .mockRejectedValue(new AgentAuthError('Token de agente inválido', 401));
    expectError(await callTool('whoami'), 'unauthorized');
  });

  it('forbidden when the company is not allow-listed', async () => {
    jest
      .mocked(resolveAgentContext)
      .mockRejectedValue(new AgentAuthError('Compañía no autorizada para esta conexión', 403));
    expectError(await callTool('list_tickets', { company_id: 8 }), 'forbidden');
  });

  it('forbidden when a read-only token writes', async () => {
    jest
      .mocked(resolveAgentContext)
      .mockImplementation(async (_header, companyId) => ({
        ...agentUser,
        scopes: ['read' as const],
        companyId,
      }));
    expectError(
      await callTool('update_ticket_status', { company_id: 7, ticket_id: 1, finished: true }),
      'forbidden',
    );
    expect(updateAgentTicketStatus).not.toHaveBeenCalled();
  });

  it('not_found when the ticket is missing', async () => {
    jest.mocked(getAgentTicket).mockRejectedValue(new Error('Ticket no encontrado'));
    expectError(await callTool('get_ticket', { company_id: 7, ticket_id: '1' }), 'not_found');
  });

  it('validation when the ticket id is malformed', async () => {
    expectError(
      await callTool('get_ticket', { company_id: 7, ticket_id: 'abc' }),
      'validation',
    );
  });

  it('validation when company_id is invalid', async () => {
    jest
      .mocked(resolveAgentContext)
      .mockRejectedValue(new AgentAuthError('company_id inválido', 400));
    expectError(await callTool('list_clients', { company_id: 7 }), 'validation');
  });

  it('internal without leaking the original message', async () => {
    jest
      .mocked(listAgentClients)
      .mockRejectedValue(new Error('relation "Client" does not exist'));
    const result = await callTool('list_clients', { company_id: 7 });
    expectError(result, 'internal');
    expect(result.content[0].text).not.toContain('relation');
  });
});
