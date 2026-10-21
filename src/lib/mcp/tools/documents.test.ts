/** @jest-environment node */
import { InMemoryTransport, McpServer } from '@modelcontextprotocol/server';
import {
  getAgentCompanySummary,
  getAgentDocument,
  listAgentDocuments,
} from '@/lib/mcp/domain/documents';
import {
  companySummaryOutputSchema,
  errorSchema,
  getDocumentOutputSchema,
  listDocumentsOutputSchema,
} from '@/lib/mcp/schemas';
import { McpToolError } from '@/lib/mcp/tool-helpers';
import { registerDocumentTools } from '@/lib/mcp/tools/documents';
import { AgentAuthError, resolveAgentContext } from '@/lib/server/resolve-agent-context';

jest.mock('@/lib/logger', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}));

jest.mock('@/lib/rate-limiter', () => ({
  checkRateLimit: jest.fn().mockResolvedValue(true),
}));

jest.mock('@/lib/mcp/domain/documents', () => ({
  getAgentCompanySummary: jest.fn(),
  getAgentDocument: jest.fn(),
  listAgentDocuments: jest.fn(),
}));

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
    assertScope: jest.fn((agent: { scopes: string[] }, scope: string) => {
      if (!agent.scopes.includes(scope)) {
        throw new MockAgentAuthError(`El token no tiene el scope "${scope}"`, 403);
      }
    }),
  };
});

const agent = {
  userId: 5n,
  scopes: ['read' as const],
  allowedCompanyIds: [7],
  authSource: 'api_key' as const,
  apiKeyId: 3,
  rateLimitIdentity: 3,
};

const summary = {
  id: '9001',
  client_id: 42,
  client_name: 'Ana López',
  ticket_date: new Date('2026-10-01T15:00:00.000Z'),
  total: 1200,
  paid: 200,
  finished: true,
  company_id: 7,
  created_at: new Date('2026-10-01T15:00:00.000Z'),
  kind: 'ticket' as const,
  folio: { prefix: 'R', number: 12, label: 'R-0012' },
  payment_status: 'parcial' as const,
  balance: 1000,
  presupuesto_status: null,
  updated_at: null,
};

const detail = {
  ...summary,
  lines: [
    {
      id: 1,
      service_id: null,
      name: 'Instalación',
      quantity: 1,
      price: 1000,
      subtotal: 1200,
      materials: [{ name: 'Tubo', quantity: 2, unit: 'm', price: 100 }],
    },
  ],
  work_notes: 'Revisar fuga',
  source_presupuesto_folio: { prefix: 'P', number: 3, label: 'P-0003' },
  converted_to_document_id: null,
  client: {
    id: 42,
    name: 'Ana López',
    phone: '5512345678',
    email: null,
    address: 'Calle 1 #2, Centro',
  },
  created_by: { id: '5', name: 'Jorge' },
  urls: {
    app: 'http://localhost:3069/tickets/9001',
    pdf: 'http://localhost:3069/tickets/9001/recibo',
    share: null,
  },
};

const companySummary = {
  date: '2026-10-19',
  queue: {
    counts: { hoy: 1, atrasados: 0, por_cobrar: 1, recordatorios: 0 },
    hoy: [summary],
    atrasados: [],
  },
  por_cobrar_balance: 1000,
  pending_balance_total: 1000,
  active_tickets: 1,
  payment_status_counts: {
    pendiente: { count: 0, amount: 0 },
    parcial: { count: 1, amount: 1200 },
    pagado: { count: 0, amount: 0 },
  },
  presupuestos_open: 2,
};

type RpcResponse = {
  id: number;
  result?: Record<string, unknown>;
  error?: { code: number; message: string };
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

const expectError = (result: CallResult, code: string) => {
  expect(result.isError).toBe(true);
  expect(errorSchema.safeParse(result.structuredContent).success).toBe(true);
  expect(result.structuredContent).toMatchObject({ error: { code } });
};

beforeAll(async () => {
  const server = new McpServer(
    { name: 'zigzag', version: '2.0.0' },
    { capabilities: { tools: { listChanged: true } } },
  );
  registerDocumentTools(server);

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
  jest
    .mocked(resolveAgentContext)
    .mockImplementation(async (_header, companyId) => ({ ...agent, companyId }));
  jest
    .mocked(listAgentDocuments)
    .mockResolvedValue({ documents: [summary], next_cursor: 'eyJjIjoiMjAyNi0xMC0wMSJ9' });
  jest.mocked(getAgentDocument).mockResolvedValue(detail);
  jest.mocked(getAgentCompanySummary).mockResolvedValue(companySummary);
});

describe('document tools: tools/list', () => {
  it('declares the three read tools with outputSchema and read-only annotations', async () => {
    const response = await rpc('tools/list');
    const tools = (
      response.result as {
        tools: Array<{
          name: string;
          outputSchema?: Record<string, unknown>;
          annotations?: Record<string, unknown>;
        }>;
      }
    ).tools;
    expect(tools.map((tool) => tool.name).sort()).toEqual([
      'get_company_summary',
      'get_document',
      'list_documents',
    ]);
    for (const tool of tools) {
      expect(tool.outputSchema).toMatchObject({ type: 'object' });
      expect(tool.annotations).toEqual({
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      });
    }
  });
});

describe('document tools: tools/call', () => {
  it.each([
    ['list_documents', { company_id: 7 }, listDocumentsOutputSchema],
    ['get_document', { company_id: 7, document_id: '9001' }, getDocumentOutputSchema],
    ['get_company_summary', { company_id: 7 }, companySummaryOutputSchema],
  ] as const)('%s returns structuredContent valid against its outputSchema', async (name, args, schema) => {
    const result = await callTool(name, args);
    expect(result.isError).toBeUndefined();
    expect(schema.safeParse(result.structuredContent).error).toBeUndefined();
    expect(JSON.parse(result.content[0].text)).toEqual(result.structuredContent);
  });

  it('list_documents passes every filter through, without company_id', async () => {
    await callTool('list_documents', {
      company_id: 7,
      kind: 'presupuesto',
      client_id: 42,
      folio: 'P-3',
      date_from: '2026-10-01',
      date_to: '2026-10-31',
      payment_status: 'pendiente',
      finished: false,
      query: 'ana',
      limit: 10,
      cursor: 'abc',
    });
    expect(listAgentDocuments).toHaveBeenCalledWith(expect.objectContaining({ companyId: 7 }), {
      kind: 'presupuesto',
      client_id: 42,
      folio: 'P-3',
      date_from: '2026-10-01',
      date_to: '2026-10-31',
      payment_status: 'pendiente',
      finished: false,
      query: 'ana',
      limit: 10,
      cursor: 'abc',
    });
  });

  it('list_documents rejects a payment_status outside the enum', async () => {
    const response = await rpc('tools/call', {
      name: 'list_documents',
      arguments: { company_id: 7, payment_status: 'paid' },
    });
    const result = (response.result ?? {}) as CallResult;
    expect(response.error ?? result.isError).toBeTruthy();
    expect(listAgentDocuments).not.toHaveBeenCalled();
  });

  it('get_document sends the parsed BigInt id and an issuer for the urls', async () => {
    await callTool('get_document', { company_id: 7, document_id: 9001 });
    expect(getAgentDocument).toHaveBeenCalledWith(
      expect.objectContaining({ companyId: 7 }),
      9001n,
      { issuer: expect.stringMatching(/^https?:\/\//) },
    );
  });

  it('get_company_summary passes the date', async () => {
    await callTool('get_company_summary', { company_id: 7, date: '2026-10-19' });
    expect(getAgentCompanySummary).toHaveBeenCalledWith(
      expect.objectContaining({ companyId: 7 }),
      { date: '2026-10-19' },
    );
  });
});

describe('document tools: errors', () => {
  it('not_found when the document is missing or belongs to another company', async () => {
    jest
      .mocked(getAgentDocument)
      .mockRejectedValue(new McpToolError('not_found', 'Documento no encontrado'));
    expectError(await callTool('get_document', { company_id: 7, document_id: '1' }), 'not_found');
  });

  it('validation when document_id is malformed', async () => {
    const result = await callTool('get_document', { company_id: 7, document_id: 'R-0012' });
    expectError(result, 'validation');
    expect(result.structuredContent).toMatchObject({
      error: { message: 'document_id inválido' },
    });
    expect(getAgentDocument).not.toHaveBeenCalled();
  });

  it('validation when the cursor is bad', async () => {
    jest
      .mocked(listAgentDocuments)
      .mockRejectedValue(new McpToolError('validation', 'cursor inválido.'));
    expectError(await callTool('list_documents', { company_id: 7, cursor: 'x' }), 'validation');
  });

  it('forbidden when the company is not allow-listed', async () => {
    jest
      .mocked(resolveAgentContext)
      .mockRejectedValue(new AgentAuthError('Compañía no autorizada para esta conexión', 403));
    expectError(await callTool('get_company_summary', { company_id: 8 }), 'forbidden');
    expect(getAgentCompanySummary).not.toHaveBeenCalled();
  });
});
