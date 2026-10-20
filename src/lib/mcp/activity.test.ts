/** @jest-environment node */
import { checkRateLimit } from '@/lib/rate-limiter';
import { db } from '@/lib/db';
import { errorCodeOf, recordMcpToolCall, startToolActivity } from '@/lib/mcp/activity';
import { runAgentCompanyTool, runAgentUserTool } from '@/lib/mcp/tool-helpers';
import {
  AgentAuthError,
  resolveAgentContext,
  resolveAgentUser,
} from '@/lib/server/resolve-agent-context';
import { runRetention } from '@/lib/jobs/retention';

jest.mock('@/lib/logger', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}));

jest.mock('@/lib/observability', () => ({ captureException: jest.fn() }));

jest.mock('@/lib/rate-limiter', () => ({
  checkRateLimit: jest.fn().mockResolvedValue(true),
}));

const values = jest.fn();
jest.mock('@/lib/db', () => ({
  db: { insert: jest.fn(() => ({ values })) },
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
    parseBearerToken: jest.fn((header: string | null) => {
      if (!header) throw new MockAgentAuthError('Falta el encabezado Authorization: Bearer', 401);
      return header.replace(/^Bearer\s+/i, '');
    }),
    resolveAgentContext: jest.fn(),
    resolveAgentUser: jest.fn(),
    assertScope: jest.fn((agent: { scopes: string[] }, scope: string) => {
      if (!agent.scopes.includes(scope)) {
        throw new MockAgentAuthError(`El token no tiene el scope "${scope}"`, 403);
      }
    }),
  };
});

const agentUser = {
  userId: 5n,
  scopes: ['read' as const],
  allowedCompanyIds: [7],
  authSource: 'api_key' as const,
  apiKeyId: 3,
  rateLimitIdentity: 3,
};

const ctx = {
  http: {
    req: new Request('https://zigzag.test/api/mcp', {
      headers: { authorization: 'Bearer zz_x' },
    }),
  },
};

// Let the fire-and-forget insert (dynamic import + values) settle.
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

const insertedRows = () => values.mock.calls.map(([row]) => row);

beforeEach(() => {
  process.env.MCP_ACTIVITY_TEST_WRITES = '1';
  values.mockReset().mockResolvedValue(undefined);
  jest.mocked(db.insert).mockClear();
  jest.mocked(resolveAgentContext).mockReset();
  jest.mocked(resolveAgentUser).mockReset();
  jest.mocked(checkRateLimit).mockResolvedValue(true);
});

afterAll(() => {
  delete process.env.MCP_ACTIVITY_TEST_WRITES;
});

describe('errorCodeOf', () => {
  it('reads structuredContent.error.code of an error result', () => {
    expect(errorCodeOf({ isError: true, structuredContent: { error: { code: 'forbidden' } } })).toBe(
      'forbidden',
    );
    expect(errorCodeOf({ isError: true })).toBe('internal');
    expect(errorCodeOf({ structuredContent: { tickets: [] } })).toBeNull();
  });
});

describe('tool activity from the runners', () => {
  it('writes one row per company tool call with tool, ok, company and duration', async () => {
    jest.mocked(resolveAgentContext).mockResolvedValue({ ...agentUser, companyId: 7 });
    const result = await runAgentCompanyTool(
      'list_tickets',
      ctx,
      { company_id: 7 },
      'tickets.read',
      'read',
      async () => ({ tickets: [] }),
    );
    await settle();

    expect(result.isError).toBeUndefined();
    expect(insertedRows()).toEqual([
      expect.objectContaining({
        tool: 'list_tickets',
        user_id: 5n,
        api_key_id: 3,
        oauth_grant_id: null,
        company_id: 7,
        ok: true,
        error_code: null,
        duration_ms: expect.any(Number),
      }),
    ]);
  });

  it('records the error code, and no company, when the company check refuses', async () => {
    jest.mocked(resolveAgentContext).mockImplementation(async (_h, _c, _p, opts) => {
      opts?.onUser?.(agentUser);
      throw new AgentAuthError('Compañía no autorizada para esta conexión', 403);
    });
    const result = await runAgentCompanyTool(
      'list_tickets',
      ctx,
      { company_id: 99 },
      'tickets.read',
      'read',
      async () => ({}),
    );
    await settle();

    expect(result.structuredContent).toMatchObject({ error: { code: 'forbidden' } });
    expect(insertedRows()).toEqual([
      expect.objectContaining({ ok: false, error_code: 'forbidden', company_id: null }),
    ]);
  });

  it('records rate_limited and handler errors', async () => {
    jest.mocked(resolveAgentUser).mockResolvedValue({
      ...agentUser,
      authSource: 'oauth_grant',
      apiKeyId: undefined,
      oauthGrantId: 11,
    });
    await runAgentUserTool('list_companies', ctx, async () => {
      throw new Error('db down');
    });
    jest.mocked(checkRateLimit).mockResolvedValue(false);
    await runAgentUserTool('list_companies', ctx, async () => ({ companies: [] }));
    await settle();

    expect(insertedRows()).toEqual([
      expect.objectContaining({ oauth_grant_id: 11, api_key_id: null, error_code: 'internal' }),
      expect.objectContaining({ oauth_grant_id: 11, error_code: 'rate_limited' }),
    ]);
  });

  it('writes nothing when the token cannot be resolved', async () => {
    const result = await runAgentUserTool('whoami', {}, async () => ({}), {
      requireCompanies: false,
    });
    await settle();
    expect(result.structuredContent).toMatchObject({ error: { code: 'unauthorized' } });
    expect(values).not.toHaveBeenCalled();
  });

  it('never changes the response when the insert fails', async () => {
    jest.mocked(resolveAgentUser).mockResolvedValue(agentUser);
    const payload = async () => ({ companies: [{ id: 7, name: 'ClimaTotal' }] });

    values.mockResolvedValue(undefined);
    const healthy = await runAgentUserTool('list_companies', ctx, payload);

    values.mockRejectedValue(new Error('insert failed'));
    const rejected = await runAgentUserTool('list_companies', ctx, payload);

    values.mockImplementation(() => {
      throw new Error('sync throw');
    });
    const thrown = await runAgentUserTool('list_companies', ctx, payload);
    await settle();

    expect(rejected).toEqual(healthy);
    expect(thrown).toEqual(healthy);
    expect(values).toHaveBeenCalledTimes(3);
  });

  it('does not wait for the insert before answering', async () => {
    jest.mocked(resolveAgentUser).mockResolvedValue(agentUser);
    values.mockReturnValue(new Promise(() => undefined));
    const result = await runAgentUserTool('list_companies', ctx, async () => ({ companies: [] }));
    expect(result.structuredContent).toEqual({ companies: [] });
  });
});

describe('startToolActivity', () => {
  it('measures the duration and writes once even if end runs twice', async () => {
    let t = 1_000;
    const activity = startToolActivity('get_ticket', () => t);
    activity.identify({ userId: 1n, apiKeyId: 2 });
    t = 1_250;
    activity.end({ structuredContent: {} });
    activity.end({ structuredContent: {} });
    await activity.flush();
    expect(insertedRows()).toEqual([expect.objectContaining({ duration_ms: 250 })]);
  });

  it('skips writes in unit tests unless they opt in', async () => {
    delete process.env.MCP_ACTIVITY_TEST_WRITES;
    await recordMcpToolCall({
      tool: 'whoami',
      user_id: 1n,
      ok: true,
      duration_ms: 1,
    });
    expect(values).not.toHaveBeenCalled();
  });
});

describe('runRetention', () => {
  it('keeps running the other rules when one fails', async () => {
    const result = await runRetention([
      { name: 'broken', run: async () => Promise.reject(new Error('nope')) },
      { name: 'fine', run: async () => 4 },
    ]);
    expect(result).toEqual({ broken: 'failed', fine: 4 });
  });
});
