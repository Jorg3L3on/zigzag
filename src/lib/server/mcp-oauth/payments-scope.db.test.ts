/**
 * @jest-environment node
 *
 * The payments scope (ZIG-I23-7) on real grants and keys: a grant or key
 * keeps exactly the scopes it was given. Refreshing never adds payments, and
 * a key or grant that holds it keeps it. Needs a local, migrated Postgres;
 * skipped otherwise (see src/test/mcp-db-fixtures.ts).
 */
import { eq } from 'drizzle-orm';
import { NextRequest } from 'next/server';
import { apiKey, mcpOAuthClient } from '@/db/schema';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import {
  cleanupMcpDbFixture,
  closeTestDbPool,
  createMcpDbFixture,
  describeWithLocalDb,
  type McpDbFixture,
} from '@/test/mcp-db-fixtures';

jest.mock('@/lib/auth', () => ({ auth: jest.fn() }));

import { POST as createKeyPost } from '@/app/api/account/api-keys/route';
import {
  issueGrant,
  refreshOAuthGrant,
  resolveOAuthGrantUser,
} from '@/lib/server/mcp-oauth/grants';
import { resolveAgentUser } from '@/lib/server/resolve-agent-context';

const mockAuth = auth as jest.MockedFunction<typeof auth>;

describeWithLocalDb('payments scope on grants and keys (local Postgres)', () => {
  let fixture: McpDbFixture | null = null;
  const clientId = `jest-payments-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  beforeAll(async () => {
    fixture = await createMcpDbFixture('payments-scope');
    await db.insert(mcpOAuthClient).values({
      client_id: clientId,
      client_name: 'Jest payments',
      redirect_uris: ['https://example.com/cb'],
    });
    fixture.oauthClientIds.push(clientId);
    mockAuth.mockResolvedValue({
      user: { id: String(fixture.userId) },
    } as unknown as Awaited<ReturnType<typeof auth>>);
  });

  afterAll(async () => {
    await cleanupMcpDbFixture(fixture);
    await closeTestDbPool();
  });

  const grant = (scopes: Array<'read' | 'write' | 'payments'>) =>
    issueGrant({
      userId: fixture!.userId,
      clientId,
      scopes,
      allowedCompanyIds: [fixture!.companyId],
      resource: 'http://localhost/api/mcp',
    });

  it('an existing grant without payments never gains it on refresh', async () => {
    const tokens = await grant(['read', 'write']);
    expect((await resolveOAuthGrantUser(tokens.access_token))?.scopes).toEqual(['read', 'write']);

    const refreshed = await refreshOAuthGrant({ refreshToken: tokens.refresh_token, clientId });
    expect(refreshed.scope).toBe('read write');
    expect((await resolveOAuthGrantUser(refreshed.access_token))?.scopes).toEqual([
      'read',
      'write',
    ]);
  });

  it('a grant that was given payments keeps it, and the resolver passes it through', async () => {
    const tokens = await grant(['read', 'payments']);
    const refreshed = await refreshOAuthGrant({ refreshToken: tokens.refresh_token, clientId });
    expect(refreshed.scope).toBe('read payments');
    expect((await resolveOAuthGrantUser(refreshed.access_token))?.scopes).toEqual([
      'read',
      'payments',
    ]);
  });

  it('Nueva llave stores payments only when asked; old keys keep their scopes', async () => {
    const create = (scopes?: string[]) =>
      createKeyPost(
        new NextRequest('http://localhost/api/account/api-keys', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            name: 'Llave de pagos',
            allowed_company_ids: [fixture!.companyId],
            ...(scopes ? { scopes } : {}),
          }),
        }),
      );

    const plain = await (await create()).json();
    expect(plain.scopes).toEqual(['read']);
    const withPayments = await (await create(['read', 'payments'])).json();
    expect(withPayments.scopes).toEqual(['read', 'payments']);
    await expect(resolveAgentUser(withPayments.token)).resolves.toMatchObject({
      scopes: ['read', 'payments'],
    });

    // The fixture's key was made before this phase: still read only.
    const [old] = await db
      .select({ scopes: apiKey.scopes })
      .from(apiKey)
      .where(eq(apiKey.user_id, fixture!.userId))
      .orderBy(apiKey.id)
      .limit(1);
    expect(old.scopes).toEqual(['read']);
    await expect(resolveAgentUser(fixture!.apiKeyToken)).resolves.toMatchObject({
      scopes: ['read'],
    });
  });
});
