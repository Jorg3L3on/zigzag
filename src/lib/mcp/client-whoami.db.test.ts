/**
 * @jest-environment node
 *
 * The Conexiones `Probar` row: last successful whoami per client, from the
 * phase-8 log, against a local Postgres (skipped unless DATABASE_URL is local).
 */
import { eq } from 'drizzle-orm';
import { apiKey, mcpOAuthClient, mcpOAuthGrant, mcpToolCall } from '@/db/schema';
import { db } from '@/lib/db';
import { lastWhoamiByClient } from '@/lib/mcp/client-whoami';
import { issueGrant } from '@/lib/server/mcp-oauth/grants';
import {
  cleanupMcpDbFixture,
  closeTestDbPool,
  createMcpDbFixture,
  describeWithLocalDb,
  type McpDbFixture,
} from '@/test/mcp-db-fixtures';

jest.mock('@/lib/auth', () => ({ auth: jest.fn() }));

describeWithLocalDb('lastWhoamiByClient (local Postgres)', () => {
  let fixture: McpDbFixture | null = null;
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const claudeClient = `jest-claude-${stamp}`;
  const fakeClaude = `jest-fake-claude-${stamp}`;

  beforeAll(async () => {
    fixture = await createMcpDbFixture('client-whoami');
    await db.insert(mcpOAuthClient).values([
      {
        client_id: claudeClient,
        client_name: 'Claude',
        redirect_uris: ['https://claude.ai/api/mcp/auth_callback'],
      },
      {
        client_id: fakeClaude,
        client_name: 'Claude',
        redirect_uris: ['https://evil.example.net/cb'],
      },
    ]);
    fixture.oauthClientIds.push(claudeClient, fakeClaude);
  });

  afterAll(async () => {
    await cleanupMcpDbFixture(fixture);
    await closeTestDbPool();
  });

  const grantIdFor = async (clientId: string, accessToken: string) => {
    const [row] = await db
      .select({ id: mcpOAuthGrant.id })
      .from(mcpOAuthGrant)
      .where(eq(mcpOAuthGrant.token_prefix, accessToken.slice(0, 20)));
    expect(row).toBeDefined();
    return row.id;
  };

  it('attributes whoami calls to Claude (OAuth) and Cursor (API key), newest successful first', async () => {
    const empty = await lastWhoamiByClient(fixture!.userId);
    expect(empty).toEqual({ chatgpt: null, grok: null, claude: null, cursor: null });

    const grantArgs = {
      userId: fixture!.userId,
      scopes: ['read' as const],
      allowedCompanyIds: [fixture!.companyId],
      resource: 'http://localhost/api/mcp',
    };
    const claude = await issueGrant({ ...grantArgs, clientId: claudeClient });
    const fake = await issueGrant({ ...grantArgs, clientId: fakeClaude });
    const claudeGrant = await grantIdFor(claudeClient, claude.access_token);
    const fakeGrant = await grantIdFor(fakeClaude, fake.access_token);
    const [key] = await db
      .select({ id: apiKey.id, name: apiKey.name })
      .from(apiKey)
      .where(eq(apiKey.user_id, fixture!.userId));

    const now = Date.now();
    const call = (over: Partial<typeof mcpToolCall.$inferInsert>) => ({
      user_id: fixture!.userId,
      tool: 'whoami',
      ok: true,
      duration_ms: 5,
      ...over,
    });
    await db.insert(mcpToolCall).values([
      call({ oauth_grant_id: claudeGrant, created_at: new Date(now - 60 * 60_000) }),
      // A failed whoami does not count.
      call({ oauth_grant_id: claudeGrant, ok: false, error_code: 'unauthorized', created_at: new Date(now - 60_000) }),
      // Another tool does not count.
      call({ oauth_grant_id: claudeGrant, tool: 'search', created_at: new Date(now - 30_000) }),
      // A client that only borrows the name is not Claude.
      call({ oauth_grant_id: fakeGrant, created_at: new Date(now - 10_000) }),
      call({ api_key_id: key.id, created_at: new Date(now - 5 * 60_000) }),
    ]);

    const result = await lastWhoamiByClient(fixture!.userId);
    expect(result.chatgpt).toBeNull();
    expect(result.grok).toBeNull();
    expect(result.claude).toEqual({
      at: new Date(now - 60 * 60_000).toISOString(),
      connection: 'Claude',
    });
    expect(result.cursor).toEqual({
      at: new Date(now - 5 * 60_000).toISOString(),
      connection: key.name,
    });
  });
});
