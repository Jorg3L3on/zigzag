/**
 * @jest-environment node
 *
 * The MCP route end to end against a local Postgres: transport auth, the
 * JSON-RPC handshake, the tool list contract and tenant isolation. Skipped
 * unless DATABASE_URL points at localhost (see src/test/mcp-db-fixtures.ts):
 *   DATABASE_URL=postgresql://…@localhost:5433/<copy> npx jest src/app/api/mcp/route.test.ts
 */
// security.ts pulls in next-auth (ESM); the MCP path never reads the session.
jest.mock('@/lib/auth', () => ({ auth: jest.fn() }));

import { GET, OPTIONS, POST } from '@/app/api/mcp/route';
import * as aliasRoute from '@/app/mcp/route';
import {
  cleanupMcpDbFixture,
  closeTestDbPool,
  createMcpDbFixture,
  describeWithLocalDb,
  readMcpJsonRpc,
  type McpDbFixture,
} from '@/test/mcp-db-fixtures';

const ORIGIN = 'http://localhost:3072';
const PROTOCOL_VERSION = '2025-06-18';

let nextId = 1;

const mcpRequest = (
  method: string,
  params: Record<string, unknown> | undefined,
  token: string | null,
  path = '/api/mcp',
) =>
  new Request(`${ORIGIN}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      'mcp-protocol-version': PROTOCOL_VERSION,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ jsonrpc: '2.0', id: nextId++, method, params }),
  });

type ToolCallResult = {
  content: Array<{ type: string; text: string }>;
  isError?: boolean;
};

describeWithLocalDb('/api/mcp (real handler, local Postgres)', () => {
  let fixture: McpDbFixture | null = null;

  beforeAll(async () => {
    fixture = await createMcpDbFixture('mcp-route');
  });

  afterAll(async () => {
    await cleanupMcpDbFixture(fixture);
    await closeTestDbPool();
  });

  it('answers initialize, lists tools with their full contract and calls list_companies', async () => {
    const init = await POST(
      mcpRequest(
        'initialize',
        {
          protocolVersion: PROTOCOL_VERSION,
          capabilities: {},
          clientInfo: { name: 'jest', version: '1.0.0' },
        },
        fixture!.apiKeyToken,
      ),
    );
    expect(init.status).toBe(200);
    const initBody = await readMcpJsonRpc(init);
    expect(initBody.result.serverInfo.name).toBe('zigzag');
    expect(initBody.result.capabilities.tools).toBeDefined();

    const list = await POST(mcpRequest('tools/list', {}, fixture!.apiKeyToken));
    expect(list.status).toBe(200);
    const tools = (await readMcpJsonRpc(list)).result.tools as Array<
      Record<string, unknown>
    >;
    expect(tools.length).toBeGreaterThan(0);
    for (const tool of tools) {
      expect(tool).toEqual(
        expect.objectContaining({
          name: expect.any(String),
          title: expect.any(String),
          description: expect.any(String),
          inputSchema: expect.objectContaining({ type: 'object' }),
          annotations: expect.any(Object),
        }),
      );
    }

    const call = await POST(
      mcpRequest(
        'tools/call',
        { name: 'list_companies', arguments: {} },
        fixture!.apiKeyToken,
      ),
    );
    expect(call.status).toBe(200);
    const result = (await readMcpJsonRpc(call)).result as ToolCallResult;
    expect(result.isError).toBeFalsy();
    const payload = JSON.parse(result.content[0].text);
    expect(payload.companies).toEqual([
      expect.objectContaining({ id: fixture!.companyId }),
    ]);
  });

  it('serves the same handler on the /mcp alias', async () => {
    const response = await aliasRoute.POST(
      mcpRequest(
        'tools/call',
        { name: 'list_companies', arguments: {} },
        fixture!.apiKeyToken,
        '/mcp',
      ),
    );
    expect(response.status).toBe(200);
    const result = (await readMcpJsonRpc(response)).result as ToolCallResult;
    expect(JSON.parse(result.content[0].text).companies).toHaveLength(1);
  });

  it('answers 401 with a WWW-Authenticate challenge without a token', async () => {
    const response = await POST(mcpRequest('tools/list', {}, null));

    expect(response.status).toBe(401);
    const challenge = response.headers.get('www-authenticate');
    expect(challenge).toContain('Bearer');
    expect(challenge).toContain(
      `resource_metadata="${ORIGIN}/.well-known/oauth-protected-resource"`,
    );
    expect(response.headers.get('access-control-expose-headers')).toContain(
      'WWW-Authenticate',
    );

    const viaGet = await GET(new Request(`${ORIGIN}/api/mcp`));
    expect(viaGet.status).toBe(401);
  });

  it('answers 401 for a bogus token', async () => {
    const response = await POST(mcpRequest('tools/list', {}, 'zigzag_not-a-real-key'));
    expect(response.status).toBe(401);
  });

  it('returns a 403 error result for a company outside the allow-list', async () => {
    const response = await POST(
      mcpRequest(
        'tools/call',
        {
          name: 'list_tickets',
          arguments: { company_id: fixture!.companyId + 1_000_000 },
        },
        fixture!.apiKeyToken,
      ),
    );
    expect(response.status).toBe(200);
    const result = (await readMcpJsonRpc(response)).result as ToolCallResult;
    expect(result.isError).toBe(true);
    expect(JSON.parse(result.content[0].text).error).toBe(
      'Compañía no autorizada para esta conexión',
    );
  });

  it('answers OPTIONS with 204 and the CORS headers', () => {
    for (const handler of [OPTIONS, aliasRoute.OPTIONS]) {
      const response = handler();
      expect(response.status).toBe(204);
      expect(response.headers.get('access-control-allow-origin')).toBe('*');
      expect(response.headers.get('access-control-allow-methods')).toBe(
        'GET, POST, DELETE, OPTIONS',
      );
      expect(response.headers.get('access-control-allow-headers')).toContain(
        'Authorization',
      );
      expect(response.headers.get('access-control-allow-headers')).toContain(
        'mcp-protocol-version',
      );
    }
  });
});
