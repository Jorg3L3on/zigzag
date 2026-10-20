/** @jest-environment node */
import { z } from 'zod';
import { checkRateLimit } from '@/lib/rate-limiter';
import { errorSchema } from '@/lib/mcp/schemas';
import {
  errorResult,
  McpToolError,
  runAgentCompanyTool,
  runAgentUserTool,
  toErrorResult,
  toolResult,
} from '@/lib/mcp/tool-helpers';
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

const ctxWithRequest = {
  http: { req: new Request('https://zigzag.test/api/mcp', { headers: { authorization: 'Bearer zz_x' } }) },
};

const parseText = (result: { content: Array<{ text: string }> }) =>
  JSON.parse(result.content[0].text);

beforeEach(() => {
  jest.mocked(resolveAgentContext).mockReset();
  jest.mocked(resolveAgentUser).mockReset();
  jest.mocked(checkRateLimit).mockResolvedValue(true);
});

describe('toolResult', () => {
  it('returns structuredContent and the same JSON as a text block', () => {
    const result = toolResult({ ok: true, items: [1, 2] });
    expect(result.isError).toBeUndefined();
    expect(result.structuredContent).toEqual({ ok: true, items: [1, 2] });
    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe('text');
    expect(parseText(result)).toEqual(result.structuredContent);
  });

  it('serialises BigInt as string, Date as ISO and drops undefined', () => {
    const result = toolResult({
      id: 9001n,
      at: new Date('2026-01-15T10:00:00.000Z'),
      total: 150.5,
      missing: undefined,
    });
    expect(result.structuredContent).toEqual({
      id: '9001',
      at: '2026-01-15T10:00:00.000Z',
      total: 150.5,
    });
    expect(parseText(result)).toEqual(result.structuredContent);
  });
});

describe('errorResult', () => {
  it('returns isError with a coded error in structuredContent and text', () => {
    const result = errorResult('not_found', 'Ticket no encontrado');
    expect(result.isError).toBe(true);
    expect(result.structuredContent).toEqual({
      error: { code: 'not_found', message: 'Ticket no encontrado' },
    });
    expect(parseText(result)).toEqual(result.structuredContent);
    expect(errorSchema.safeParse(result.structuredContent).success).toBe(true);
  });

  it('carries issues and _meta when given', () => {
    const result = errorResult('unauthorized', 'x', {
      issues: [{ path: 'a', message: 'b' }],
      _meta: { 'mcp/www_authenticate': ['Bearer'] },
    });
    expect(result.structuredContent).toEqual({
      error: { code: 'unauthorized', message: 'x', issues: [{ path: 'a', message: 'b' }] },
    });
    expect(result._meta).toEqual({ 'mcp/www_authenticate': ['Bearer'] });
  });
});

describe('toErrorResult', () => {
  const codeOf = (error: unknown) =>
    (toErrorResult(error).structuredContent as { error: { code: string; message: string } })
      .error;

  it.each([
    [401, 'unauthorized'],
    [403, 'forbidden'],
    [400, 'validation'],
    [404, 'not_found'],
    [429, 'rate_limited'],
  ])('maps AgentAuthError %i to %s', (status, code) => {
    const error = codeOf(new AgentAuthError('mensaje', status));
    expect(error.code).toBe(code);
    expect(error.message).toBe('mensaje');
  });

  it('maps ZodError to validation with the issue list', () => {
    const parsed = z.object({ limit: z.number() }).safeParse({ limit: 'x' });
    const result = toErrorResult(parsed.error);
    const body = result.structuredContent as {
      error: { code: string; issues: Array<{ path: string }> };
    };
    expect(result.isError).toBe(true);
    expect(body.error.code).toBe('validation');
    expect(body.error.issues).toEqual([expect.objectContaining({ path: 'limit' })]);
    expect(errorSchema.safeParse(body).success).toBe(true);
  });

  it("maps 'Ticket no encontrado' to not_found and bad ids to validation", () => {
    expect(codeOf(new Error('Ticket no encontrado')).code).toBe('not_found');
    expect(codeOf(new Error('ticket_id inválido')).code).toBe('validation');
  });

  it('keeps the code of an McpToolError', () => {
    expect(codeOf(new McpToolError('not_found', 'Cliente no encontrado'))).toEqual({
      code: 'not_found',
      message: 'Cliente no encontrado',
    });
  });

  it('maps unknown errors to internal without leaking their message', () => {
    const error = codeOf(new Error('connect ECONNREFUSED 10.0.0.1:5432 password=hunter2'));
    expect(error.code).toBe('internal');
    expect(error.message).not.toMatch(/ECONNREFUSED|hunter2/);
    expect(codeOf('boom').code).toBe('internal');
  });
});

describe('runAgentCompanyTool', () => {
  it('wraps the payload with toolResult', async () => {
    jest
      .mocked(resolveAgentContext)
      .mockResolvedValue({ ...agentUser, companyId: 7 });
    const result = await runAgentCompanyTool(
      'list_tickets',
      ctxWithRequest,
      { company_id: 7 },
      'tickets.read',
      'read',
      async () => ({ tickets: [{ id: 1n }] }),
    );
    expect(result.structuredContent).toEqual({ tickets: [{ id: '1' }] });
    expect(resolveAgentContext).toHaveBeenCalledWith('Bearer zz_x', 7, 'tickets.read');
  });

  it('returns forbidden when the token lacks the scope', async () => {
    jest
      .mocked(resolveAgentContext)
      .mockResolvedValue({ ...agentUser, companyId: 7 });
    const result = await runAgentCompanyTool(
      'create_ticket',
      ctxWithRequest,
      { company_id: 7 },
      'tickets.write',
      'write',
      async () => ({}),
    );
    expect(result.isError).toBe(true);
    expect(result.structuredContent).toMatchObject({ error: { code: 'forbidden' } });
  });

  it('returns rate_limited when the limiter says no', async () => {
    jest
      .mocked(resolveAgentContext)
      .mockResolvedValue({ ...agentUser, companyId: 7 });
    jest.mocked(checkRateLimit).mockResolvedValue(false);
    const fn = jest.fn();
    const result = await runAgentCompanyTool(
      'list_tickets',
      ctxWithRequest,
      { company_id: 7 },
      'tickets.read',
      'read',
      fn,
    );
    expect(fn).not.toHaveBeenCalled();
    expect(result.structuredContent).toMatchObject({ error: { code: 'rate_limited' } });
  });

  it('returns unauthorized when there is no bearer token', async () => {
    jest
      .mocked(resolveAgentContext)
      .mockRejectedValue(new AgentAuthError('Falta el encabezado Authorization: Bearer', 401));
    const result = await runAgentCompanyTool(
      'list_tickets',
      {},
      { company_id: 7 },
      'tickets.read',
      'read',
      async () => ({}),
    );
    expect(result.structuredContent).toMatchObject({ error: { code: 'unauthorized' } });
  });
});

describe('runAgentUserTool', () => {
  it('returns forbidden when the connection has no companies', async () => {
    jest
      .mocked(resolveAgentUser)
      .mockResolvedValue({ ...agentUser, allowedCompanyIds: [] });
    const result = await runAgentUserTool('list_companies', ctxWithRequest, async () => ({}));
    expect(result.structuredContent).toMatchObject({ error: { code: 'forbidden' } });
  });

  it('runs without companies when requireCompanies is false', async () => {
    jest
      .mocked(resolveAgentUser)
      .mockResolvedValue({ ...agentUser, allowedCompanyIds: [] });
    const result = await runAgentUserTool(
      'whoami',
      ctxWithRequest,
      async () => ({ companies: [] }),
      { requireCompanies: false },
    );
    expect(result.isError).toBeUndefined();
    expect(result.structuredContent).toEqual({ companies: [] });
  });

  it('returns unauthorized without an Authorization header', async () => {
    const result = await runAgentUserTool('whoami', {}, async () => ({}));
    expect(result.structuredContent).toMatchObject({ error: { code: 'unauthorized' } });
    expect(resolveAgentUser).not.toHaveBeenCalled();
  });
});
