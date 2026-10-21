/**
 * @jest-environment node
 *
 * ZIG-I23-11 against a local Postgres: credential revocation on password change
 * and deactivation, API key expiry and audit, the CIMD 24 h re-fetch, and the
 * OAuth retention rules. Skipped unless DATABASE_URL points at localhost.
 */
import { and, count, eq, inArray } from 'drizzle-orm';
import { NextRequest } from 'next/server';
import {
  governanceAuditEvent,
  mcpOAuthAuthorizationCode,
  mcpOAuthClient,
  mcpOAuthGrant,
  mcpOAuthJwtAssertion,
  mcpOAuthTokenAttempt,
} from '@/db/schema';
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
import { DELETE as revokeKeyDelete } from '@/app/api/account/api-keys/[id]/route';
import {
  GET as tokenGet,
  OPTIONS as tokenOptions,
} from '@/app/api/oauth/token/route';
import { revokeAgentAccessForUser } from '@/lib/session-revocation';
import { resolveOAuthClient } from '@/lib/server/mcp-oauth/clients';
import { issueGrant, resolveOAuthGrantUser } from '@/lib/server/mcp-oauth/grants';
import {
  pruneExpiredAuthorizationCodes,
  pruneExpiredJwtAssertions,
  pruneStaleDcrClients,
  pruneTokenAttempts,
} from '@/lib/server/mcp-oauth/retention';
import { resolveAgentUser } from '@/lib/server/resolve-agent-context';

const DAY_MS = 24 * 60 * 60 * 1000;
const mockAuth = auth as jest.MockedFunction<typeof auth>;

describeWithLocalDb('MCP OAuth hardening (local Postgres)', () => {
  let fixture: McpDbFixture | null = null;
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const dcrClientId = `jest-dcr-${stamp}`;
  const cimdClientId = `https://cimd-${stamp}.example.com/oauth/client.json`;

  const auditEvents = (event: string) =>
    db
      .select()
      .from(governanceAuditEvent)
      .where(
        and(
          eq(governanceAuditEvent.actor_user_id, fixture!.userId),
          eq(governanceAuditEvent.event_type, event),
        ),
      );

  beforeAll(async () => {
    fixture = await createMcpDbFixture('hardening');
    mockAuth.mockResolvedValue({
      user: { id: String(fixture.userId) },
    } as Awaited<ReturnType<typeof auth>>);
    await db.insert(mcpOAuthClient).values({
      client_id: dcrClientId,
      client_name: 'Jest hardening',
      redirect_uris: ['https://example.com/cb'],
    });
    fixture.oauthClientIds.push(dcrClientId, cimdClientId);
  });

  afterAll(async () => {
    await db.delete(mcpOAuthJwtAssertion).where(eq(mcpOAuthJwtAssertion.client_id, dcrClientId));
    await cleanupMcpDbFixture(fixture);
    await closeTestDbPool();
  });

  it('creates API keys that expire in 365 days by default and caps longer requests', async () => {
    const created = await createKeyPost(
      new NextRequest('http://localhost/api/account/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Jest key',
          scopes: ['read'],
          allowed_company_ids: [fixture!.companyId],
        }),
      }),
    );
    expect(created.status).toBe(201);
    const body = (await created.json()) as { id: number; expires_at: string };
    const days = (new Date(body.expires_at).getTime() - Date.now()) / DAY_MS;
    expect(Math.round(days)).toBe(365);

    const tooLong = await createKeyPost(
      new NextRequest('http://localhost/api/account/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Jest key',
          allowed_company_ids: [fixture!.companyId],
          expires_in_days: 366,
        }),
      }),
    );
    expect(tooLong.status).toBe(400);

    expect(await auditEvents('api_key.created')).toEqual([
      expect.objectContaining({ resource_type: 'api_key', resource_id: String(body.id) }),
    ]);

    const revoked = await revokeKeyDelete(
      new NextRequest(`http://localhost/api/account/api-keys/${body.id}`, { method: 'DELETE' }),
      { params: Promise.resolve({ id: String(body.id) }) },
    );
    expect(revoked.status).toBe(200);
    expect(await auditEvents('api_key.revoked')).toEqual([
      expect.objectContaining({ resource_id: String(body.id) }),
    ]);
  });

  it('a password change revokes every API key and OAuth grant of the user, with audit rows', async () => {
    const tokens = await issueGrant({
      userId: fixture!.userId,
      clientId: dcrClientId,
      scopes: ['read'],
      allowedCompanyIds: [fixture!.companyId],
      resource: 'http://localhost/api/mcp',
    });
    expect(await resolveOAuthGrantUser(tokens.access_token)).not.toBeNull();
    await expect(resolveAgentUser(fixture!.apiKeyToken)).resolves.toBeDefined();

    const result = await revokeAgentAccessForUser(fixture!.userId, 'password_changed');
    expect(result.apiKeys).toBeGreaterThanOrEqual(1);
    expect(result.grants).toBe(1);

    expect(await resolveOAuthGrantUser(tokens.access_token)).toBeNull();
    await expect(resolveAgentUser(fixture!.apiKeyToken)).rejects.toMatchObject({ status: 401 });

    const [grant] = await db
      .select({ reason: mcpOAuthGrant.revoked_reason })
      .from(mcpOAuthGrant)
      .where(eq(mcpOAuthGrant.user_id, fixture!.userId));
    expect(grant.reason).toBe('password_changed');
    expect(await auditEvents('oauth.grant_revoked')).toEqual([
      expect.objectContaining({
        payload: expect.objectContaining({ reason: 'password_changed' }),
      }),
    ]);
    const keyAudit = await auditEvents('api_key.revoked');
    expect(
      keyAudit.some(
        (row) => (row.payload as { reason?: string })?.reason === 'password_changed',
      ),
    ).toBe(true);

  });

  it('re-fetches a CIMD document after 24 h and keeps the old row when the fetch fails', async () => {
    const document = (name: string) =>
      new Response(
        JSON.stringify({
          client_id: cimdClientId,
          client_name: name,
          redirect_uris: ['https://cimd.example.com/cb'],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    const fetchStub = jest.fn(async () => document('First name'));

    const first = await resolveOAuthClient(cimdClientId, { fetchImpl: fetchStub as typeof fetch });
    expect(first?.client_name).toBe('First name');
    expect(fetchStub).toHaveBeenCalledTimes(1);

    // Fresh copy: no fetch.
    await resolveOAuthClient(cimdClientId, { fetchImpl: fetchStub as typeof fetch });
    expect(fetchStub).toHaveBeenCalledTimes(1);

    await db
      .update(mcpOAuthClient)
      .set({ fetched_at: new Date(Date.now() - DAY_MS - 1000) })
      .where(eq(mcpOAuthClient.client_id, cimdClientId));
    const failing = jest.fn(async () => new Response('nope', { status: 500 }));
    const kept = await resolveOAuthClient(cimdClientId, { fetchImpl: failing as typeof fetch });
    expect(failing).toHaveBeenCalledTimes(1);
    expect(kept?.client_name).toBe('First name');

    const renamed = jest.fn(async () => document('Second name'));
    const refreshed = await resolveOAuthClient(cimdClientId, {
      fetchImpl: renamed as typeof fetch,
    });
    expect(refreshed?.client_name).toBe('Second name');
  });

  it('does not log preflight or GET token attempts', async () => {
    const before = await db.select({ n: count() }).from(mcpOAuthTokenAttempt);
    expect(tokenOptions().status).toBe(204);
    expect(tokenGet().status).toBe(405);
    const after = await db.select({ n: count() }).from(mcpOAuthTokenAttempt);
    expect(after[0].n).toBe(before[0].n);
  });

  it('retention deletes old token attempts, expired codes, stale DCR clients and spent jtis', async () => {
    const now = Date.now();
    const [oldAttempt, newAttempt] = await db
      .insert(mcpOAuthTokenAttempt)
      .values([
        { path: '/api/oauth/token', method: 'POST', created_at: new Date(now - 31 * DAY_MS) },
        { path: '/api/oauth/token', method: 'POST', created_at: new Date(now - 29 * DAY_MS) },
      ])
      .returning({ id: mcpOAuthTokenAttempt.id });

    const staleClient = `jest-stale-${stamp}`;
    const freshClient = `jest-fresh-${stamp}`;
    await db.insert(mcpOAuthClient).values([
      {
        client_id: staleClient,
        client_name: 'stale',
        redirect_uris: ['https://example.com/cb'],
        created_at: new Date(now - 8 * DAY_MS),
      },
      {
        client_id: freshClient,
        client_name: 'fresh',
        redirect_uris: ['https://example.com/cb'],
        created_at: new Date(now - 2 * DAY_MS),
      },
    ]);
    fixture!.oauthClientIds.push(staleClient, freshClient);
    // A DCR client with a grant is kept however old it is.
    await db
      .update(mcpOAuthClient)
      .set({ created_at: new Date(now - 30 * DAY_MS) })
      .where(eq(mcpOAuthClient.client_id, dcrClientId));

    const codeValues = {
      client_id: dcrClientId,
      user_id: fixture!.userId,
      redirect_uri: 'https://example.com/cb',
      scopes: ['read'],
      code_challenge: 'x'.repeat(43),
      resource: 'http://localhost/api/mcp',
    };
    const [oldCode, liveCode] = await db
      .insert(mcpOAuthAuthorizationCode)
      .values([
        { ...codeValues, code_hash: `jest-old-${stamp}`, expires_at: new Date(now - 2 * DAY_MS) },
        { ...codeValues, code_hash: `jest-live-${stamp}`, expires_at: new Date(now + 60_000) },
      ])
      .returning({ id: mcpOAuthAuthorizationCode.id });

    await db.insert(mcpOAuthJwtAssertion).values([
      { jti: `jest-spent-${stamp}`, client_id: dcrClientId, expires_at: new Date(now - 1000) },
      { jti: `jest-live-${stamp}`, client_id: dcrClientId, expires_at: new Date(now + 60_000) },
    ]);

    expect(await pruneTokenAttempts()).toBeGreaterThanOrEqual(1);
    expect(await pruneExpiredAuthorizationCodes()).toBeGreaterThanOrEqual(1);
    expect(await pruneStaleDcrClients()).toBeGreaterThanOrEqual(1);
    expect(await pruneExpiredJwtAssertions()).toBeGreaterThanOrEqual(1);

    const attempts = await db
      .select({ id: mcpOAuthTokenAttempt.id })
      .from(mcpOAuthTokenAttempt)
      .where(inArray(mcpOAuthTokenAttempt.id, [oldAttempt.id, newAttempt.id]));
    expect(attempts.map((r) => r.id)).toEqual([newAttempt.id]);

    const codes = await db
      .select({ id: mcpOAuthAuthorizationCode.id })
      .from(mcpOAuthAuthorizationCode)
      .where(inArray(mcpOAuthAuthorizationCode.id, [oldCode.id, liveCode.id]));
    expect(codes.map((r) => r.id)).toEqual([liveCode.id]);

    const clients = await db
      .select({ client_id: mcpOAuthClient.client_id })
      .from(mcpOAuthClient)
      .where(inArray(mcpOAuthClient.client_id, [staleClient, freshClient, dcrClientId, cimdClientId]));
    expect(clients.map((r) => r.client_id).sort()).toEqual(
      [freshClient, dcrClientId, cimdClientId].sort(),
    );

    const jtis = await db
      .select({ jti: mcpOAuthJwtAssertion.jti })
      .from(mcpOAuthJwtAssertion)
      .where(eq(mcpOAuthJwtAssertion.client_id, dcrClientId));
    expect(jtis.map((r) => r.jti)).toEqual([`jest-live-${stamp}`]);

    await db.delete(mcpOAuthTokenAttempt).where(eq(mcpOAuthTokenAttempt.id, newAttempt.id));
  });
});
