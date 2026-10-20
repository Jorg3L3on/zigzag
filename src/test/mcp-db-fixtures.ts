import { eq, inArray } from 'drizzle-orm';
import { apiKey, company, mcpOAuthClient, user } from '@/db/schema';
import { db } from '@/lib/db';
import { generateAgentToken, hashAgentToken } from '@/lib/server/agent-token';

const LOCAL_DB_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

/**
 * True only when DATABASE_URL points at a Postgres on this machine. Under jest,
 * Next loads `.env` (production Neon) and skips `.env.local`, so the MCP
 * integration suites stay skipped unless a local DB is configured, e.g. in an
 * untracked `.env.test.local` or `DATABASE_URL=postgresql://…@localhost:5433/<copy>`.
 */
export const hasLocalTestDatabase = (): boolean => {
  const url = process.env.DATABASE_URL;
  if (!url) return false;
  try {
    return LOCAL_DB_HOSTS.has(new URL(url).hostname);
  } catch {
    return false;
  }
};

export const describeWithLocalDb = hasLocalTestDatabase() ? describe : describe.skip;

export type McpDbFixture = {
  companyId: number;
  userId: bigint;
  apiKeyToken: string;
  oauthClientIds: string[];
};

/** A company, a user in it and a read API key allowed on that company. */
export const createMcpDbFixture = async (label: string): Promise<McpDbFixture> => {
  const stamp = `${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const [companyRow] = await db
    .insert(company)
    .values({
      name: `MCP test ${stamp}`,
      phone: '5550000000',
      email: `${stamp}@company.test.local`,
      street: 'x',
      exterior_number: '1',
      neighborhood: 'x',
      city: 'x',
      state: 'x',
      country: 'MX',
      postal_code: '00000',
    })
    .returning({ id: company.id });
  const [userRow] = await db
    .insert(user)
    .values({
      name: `MCP test ${stamp}`,
      email: `${stamp}@user.test.local`,
      password: 'not-a-login',
      company_id: companyRow.id,
    })
    .returning({ id: user.id });

  const { token, keyPrefix } = generateAgentToken();
  await db.insert(apiKey).values({
    user_id: userRow.id,
    name: `MCP test ${stamp}`,
    key_hash: hashAgentToken(token),
    key_prefix: keyPrefix,
    scopes: ['read'],
    allowed_company_ids: [companyRow.id],
  });

  return {
    companyId: companyRow.id,
    userId: userRow.id,
    apiKeyToken: token,
    oauthClientIds: [],
  };
};

/** Removes the fixture; OAuth codes and grants cascade from the user and client. */
export const cleanupMcpDbFixture = async (fixture: McpDbFixture | null) => {
  if (!fixture) return;
  if (fixture.oauthClientIds.length > 0) {
    await db
      .delete(mcpOAuthClient)
      .where(inArray(mcpOAuthClient.client_id, fixture.oauthClientIds));
  }
  await db.delete(apiKey).where(eq(apiKey.user_id, fixture.userId));
  await db.delete(user).where(eq(user.id, fixture.userId));
  await db.delete(company).where(eq(company.id, fixture.companyId));
};

/** Ends the module's pg pool so jest can exit without waiting on idle clients. */
export const closeTestDbPool = async () => {
  const pool = (globalThis as { pool?: { end: () => Promise<void> } }).pool;
  await pool?.end();
};

/**
 * Reads a JSON-RPC response from the MCP route, whether it answered with JSON
 * or a single-event SSE stream.
 */
export const readMcpJsonRpc = async (response: Response) => {
  const text = await response.text();
  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('text/event-stream')) {
    const data = text
      .split('\n')
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice('data:'.length).trim())
      .filter(Boolean);
    return JSON.parse(data[data.length - 1] ?? 'null');
  }
  return JSON.parse(text);
};
