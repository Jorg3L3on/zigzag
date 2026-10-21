/**
 * @jest-environment node
 *
 * Needs a migrated Postgres (migration 0035). Skipped unless MCP_ACTIVITY_DB_TEST=1:
 *   MCP_ACTIVITY_DB_TEST=1 DATABASE_URL=postgresql://…/zigzag_copy \
 *     npx jest src/lib/mcp/activity.db.test.ts
 * Never point it at production: it inserts and deletes rows.
 */
import { eq, inArray } from 'drizzle-orm';
import { apiKey, mcpToolCall, user } from '@/db/schema';
import { db } from '@/lib/db';
import { pruneMcpToolCalls, listMcpToolCalls } from '@/lib/mcp/activity';
import { runAgentUserTool } from '@/lib/mcp/tool-helpers';
import { resolveAgentUser } from '@/lib/server/resolve-agent-context';

jest.mock('@/lib/logger', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}));

jest.mock('@/lib/rate-limiter', () => ({
  checkRateLimit: jest.fn().mockResolvedValue(true),
}));

// The real resolver pulls in next-auth (ESM); the token itself is not under test.
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
    parseBearerToken: jest.fn((header: string) => header.replace(/^Bearer\s+/i, '')),
    resolveAgentContext: jest.fn(),
    resolveAgentUser: jest.fn(),
    assertScope: jest.fn(),
  };
});

const enabled = process.env.MCP_ACTIVITY_DB_TEST === '1';
const describeDb = enabled ? describe : describe.skip;

const ctx = {
  http: {
    req: new Request('https://zigzag.test/api/mcp', {
      headers: { authorization: 'Bearer zigzag_test_token' },
    }),
  },
};

const waitForRows = async (apiKeyId: number, count: number) => {
  for (let i = 0; i < 50; i += 1) {
    const rows = await db.select().from(mcpToolCall).where(eq(mcpToolCall.api_key_id, apiKeyId));
    if (rows.length >= count) return rows;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  return db.select().from(mcpToolCall).where(eq(mcpToolCall.api_key_id, apiKeyId));
};

describeDb('McpToolCall (real Postgres)', () => {
  let userId: bigint;
  let keyId: number;

  beforeAll(async () => {
    process.env.MCP_ACTIVITY_TEST_WRITES = '1';
    const [owner] = await db.select({ id: user.id }).from(user).limit(1);
    userId = owner.id;
    const [key] = await db
      .insert(apiKey)
      .values({
        user_id: userId,
        name: `activity test ${Date.now()}`,
        key_hash: 'x',
        key_prefix: `zigzag_t${Date.now()}`,
        allowed_company_ids: [4],
      })
      .returning({ id: apiKey.id });
    keyId = key.id;
  });

  afterAll(async () => {
    delete process.env.MCP_ACTIVITY_TEST_WRITES;
    await db.delete(mcpToolCall).where(eq(mcpToolCall.api_key_id, keyId));
    await db.delete(apiKey).where(eq(apiKey.id, keyId));
    // The pool keeps the process alive otherwise.
    await (db as unknown as { $client: { end: () => Promise<void> } }).$client.end();
  });

  it('writes one row per tools/call, and a failed insert leaves the response alone', async () => {
    jest.mocked(resolveAgentUser).mockResolvedValue({
      userId,
      scopes: ['read'],
      allowedCompanyIds: [4],
      authSource: 'api_key',
      apiKeyId: keyId,
      rateLimitIdentity: keyId,
    });
    const ok = await runAgentUserTool('whoami', ctx, async () => ({ user_id: String(userId) }));
    const failed = await runAgentUserTool('list_companies', ctx, async () => {
      throw new Error('boom');
    });

    const rows = await waitForRows(keyId, 2);
    expect(ok.isError).toBeUndefined();
    expect(failed.structuredContent).toMatchObject({ error: { code: 'internal' } });
    expect(rows.map((r) => [r.tool, r.ok, r.error_code]).sort()).toEqual([
      ['list_companies', false, 'internal'],
      ['whoami', true, null],
    ]);
    expect(rows.every((r) => r.duration_ms >= 0 && r.user_id === userId)).toBe(true);

    // An api_key_id that does not exist violates the FK: the insert fails,
    // the tool still answers exactly as before.
    jest.mocked(resolveAgentUser).mockResolvedValue({
      userId,
      scopes: ['read'],
      allowedCompanyIds: [4],
      authSource: 'api_key',
      apiKeyId: 2_000_000_000,
      rateLimitIdentity: 1,
    });
    const orphan = await runAgentUserTool('whoami', ctx, async () => ({ user_id: String(userId) }));
    expect(orphan).toEqual(ok);
    await new Promise((resolve) => setTimeout(resolve, 200));
    const none = await db
      .select()
      .from(mcpToolCall)
      .where(eq(mcpToolCall.api_key_id, 2_000_000_000));
    expect(none).toHaveLength(0);

    const page = await listMcpToolCalls({ userId, kind: 'api_key', connectionId: keyId, limit: 1 });
    expect(page.items).toHaveLength(1);
    expect(page.next_cursor).toBe(page.items[0].id);
    const next = await listMcpToolCalls({
      userId,
      kind: 'api_key',
      connectionId: keyId,
      limit: 1,
      cursor: page.next_cursor,
    });
    expect(next.items).toHaveLength(1);
    expect(next.next_cursor).toBeNull();
  });

  it('deletes rows older than 90 days and keeps newer ones', async () => {
    const day = 24 * 60 * 60 * 1000;
    const inserted = await db
      .insert(mcpToolCall)
      .values(
        [91, 89].map((age) => ({
          user_id: userId,
          api_key_id: keyId,
          tool: `age_${age}`,
          ok: true,
          duration_ms: 1,
          created_at: new Date(Date.now() - age * day),
        })),
      )
      .returning({ id: mcpToolCall.id, tool: mcpToolCall.tool });

    const deleted = await pruneMcpToolCalls();
    expect(deleted).toBeGreaterThanOrEqual(1);

    const left = await db
      .select({ tool: mcpToolCall.tool })
      .from(mcpToolCall)
      .where(inArray(mcpToolCall.id, inserted.map((r) => r.id)));
    expect(left.map((r) => r.tool)).toEqual(['age_89']);
  });
});
