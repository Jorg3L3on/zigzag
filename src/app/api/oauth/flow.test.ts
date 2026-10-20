/**
 * @jest-environment node
 *
 * The whole OAuth 2.1 connector flow against a local Postgres, the way ChatGPT
 * runs it: DCR → authorize → consent → token (PKCE S256 + resource) → bearer on
 * /api/mcp, plus the lifecycle rules of ZIG-I23-11: write is opt-in, codes are
 * single use (a replay revokes the grant), refresh rotates and a reused refresh
 * token revokes, refresh windows expire, access tokens last 24 h, revoke kills.
 * Skipped unless DATABASE_URL points at localhost (see src/test/mcp-db-fixtures.ts).
 */
import crypto from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { NextRequest } from 'next/server';
import {
  governanceAuditEvent,
  mcpOAuthAuthorizationCode,
  mcpOAuthGrant,
} from '@/db/schema';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import {
  cleanupMcpDbFixture,
  closeTestDbPool,
  createMcpDbFixture,
  describeWithLocalDb,
  readMcpJsonRpc,
  type McpDbFixture,
} from '@/test/mcp-db-fixtures';

jest.mock('@/lib/auth', () => ({ auth: jest.fn() }));

import { POST as mcpPost } from '@/app/api/mcp/route';
import { GET as authorizeGet } from '@/app/api/oauth/authorize/route';
import { POST as consentPost } from '@/app/api/oauth/consent/route';
import { POST as registerPost } from '@/app/api/oauth/register/route';
import { POST as revokePost } from '@/app/api/oauth/revoke/route';
import { POST as tokenPost } from '@/app/api/oauth/token/route';
import { MCP_WWW_AUTHENTICATE_META_KEY } from '@/lib/mcp/auth-challenge';
import { runAgentUserTool } from '@/lib/mcp/tool-helpers';
import { hashOAuthSecret } from '@/lib/server/mcp-oauth/tokens';

const ORIGIN = 'http://localhost:3072';
const REDIRECT_URI = 'https://chatgpt.com/connector_platform_oauth_redirect';
const DAY_MS = 24 * 60 * 60 * 1000;
const mockAuth = auth as jest.MockedFunction<typeof auth>;

const base64url = (buffer: Buffer) => buffer.toString('base64url');

const formRequest = (path: string, fields: Record<string, string>) =>
  new NextRequest(`${ORIGIN}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(fields).toString(),
  });

const jsonRequest = (path: string, body: unknown) =>
  new NextRequest(`${ORIGIN}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

const listCompanies = (token: string) =>
  mcpPost(
    new Request(`${ORIGIN}/api/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        'mcp-protocol-version': '2025-06-18',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: { name: 'list_companies', arguments: {} },
      }),
    }),
  );

type TokenResponse = {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
};

describeWithLocalDb('MCP OAuth flow (real routes, local Postgres)', () => {
  let fixture: McpDbFixture | null = null;
  let clientId = '';

  const auditEvents = async (event: string) =>
    db
      .select()
      .from(governanceAuditEvent)
      .where(
        and(
          eq(governanceAuditEvent.actor_user_id, fixture!.userId),
          eq(governanceAuditEvent.event_type, event),
        ),
      );

  const grantFor = async (accessToken: string) => {
    const rows = await db
      .select()
      .from(mcpOAuthGrant)
      .where(eq(mcpOAuthGrant.token_prefix, accessToken.slice(0, 20)));
    return rows[0];
  };

  /** authorize + consent; returns the code and its PKCE verifier. */
  const authorizeCode = async (opts: { scope?: string; allowWrite?: string } = {}) => {
    const verifier = base64url(crypto.randomBytes(32));
    const challenge = base64url(crypto.createHash('sha256').update(verifier).digest());
    const scope = opts.scope ?? 'read';
    const authorizeParams = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: REDIRECT_URI,
      code_challenge: challenge,
      code_challenge_method: 'S256',
      scope,
      state: 'jest-state',
      resource: `${ORIGIN}/mcp`,
    });
    const authorize = await authorizeGet(
      new NextRequest(`${ORIGIN}/api/oauth/authorize?${authorizeParams}`),
    );
    expect([302, 303, 307]).toContain(authorize.status);
    const consentUrl = new URL(authorize.headers.get('location')!);
    expect(consentUrl.pathname).toBe('/oauth/consent');
    // The /mcp alias normalises to the canonical resource.
    expect(consentUrl.searchParams.get('resource')).toBe(`${ORIGIN}/api/mcp`);

    const consent = await consentPost(
      jsonRequest('/api/oauth/consent', {
        client_id: clientId,
        redirect_uri: REDIRECT_URI,
        state: 'jest-state',
        scope,
        code_challenge: challenge,
        code_challenge_method: 'S256',
        resource: consentUrl.searchParams.get('resource'),
        allowed_company_ids: [String(fixture!.companyId)],
        ...(opts.allowWrite ? { allow_write: opts.allowWrite } : {}),
      }),
    );
    expect(consent.status).toBe(200);
    const callback = new URL(((await consent.json()) as { redirect_to: string }).redirect_to);
    expect(callback.searchParams.get('state')).toBe('jest-state');
    return { code: callback.searchParams.get('code')!, verifier };
  };

  const exchange = (code: string, verifier: string) =>
    tokenPost(
      formRequest('/api/oauth/token', {
        grant_type: 'authorization_code',
        code,
        redirect_uri: REDIRECT_URI,
        client_id: clientId,
        code_verifier: verifier,
        resource: `${ORIGIN}/mcp`,
      }),
    );

  const refresh = (refreshToken: string) =>
    tokenPost(
      formRequest('/api/oauth/token', {
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: clientId,
        resource: `${ORIGIN}/api/mcp`,
      }),
    );

  const connect = async (opts?: { scope?: string; allowWrite?: string }) => {
    const { code, verifier } = await authorizeCode(opts);
    const response = await exchange(code, verifier);
    expect(response.status).toBe(200);
    return { tokens: (await response.json()) as TokenResponse, code, verifier };
  };

  beforeAll(async () => {
    fixture = await createMcpDbFixture('oauth-flow');
    mockAuth.mockResolvedValue({
      user: { id: String(fixture.userId) },
    } as Awaited<ReturnType<typeof auth>>);

    const registration = await registerPost(
      jsonRequest('/api/oauth/register', {
        client_name: 'Jest flow',
        redirect_uris: [REDIRECT_URI],
      }),
    );
    expect(registration.status).toBe(201);
    clientId = ((await registration.json()) as { client_id: string }).client_id;
    fixture.oauthClientIds.push(clientId);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  afterAll(async () => {
    await cleanupMcpDbFixture(fixture);
    await closeTestDbPool();
  });

  it('runs DCR → authorize → consent → token and the bearer works on /api/mcp', async () => {
    const { tokens } = await connect();
    expect(tokens.token_type).toBe('bearer');
    expect(tokens.scope).toBe('read');
    expect(tokens.access_token).toMatch(/^zigzag_oauth_/);
    expect(tokens.expires_in).toBe(24 * 60 * 60);

    const response = await listCompanies(tokens.access_token);
    expect(response.status).toBe(200);
    const result = (await readMcpJsonRpc(response)).result;
    expect(result.isError).toBeFalsy();
    expect(JSON.parse(result.content[0].text).companies).toEqual([
      expect.objectContaining({ id: fixture!.companyId }),
    ]);

    const grant = await grantFor(tokens.access_token);
    const ttl = grant.absolute_expires_at!.getTime() - grant.created_at.getTime();
    expect(Math.round(ttl / DAY_MS)).toBe(365);
    expect(
      Math.round((grant.refresh_expires_at!.getTime() - Date.now()) / DAY_MS),
    ).toBe(90);

    const consentAudit = await auditEvents('oauth.consent_granted');
    expect(consentAudit[0]?.payload).toEqual(
      expect.objectContaining({
        redirect_host: 'chatgpt.com',
        scopes: ['read'],
        allowed_company_ids: [fixture!.companyId],
      }),
    );
  });

  it('grants write only when allow_write=true is posted', async () => {
    const withoutOptIn = await connect({ scope: 'read write' });
    expect(withoutOptIn.tokens.scope).toBe('read');

    const declined = await connect({ scope: 'read write', allowWrite: 'false' });
    expect(declined.tokens.scope).toBe('read');

    const optedIn = await connect({ scope: 'read write', allowWrite: 'true' });
    expect(optedIn.tokens.scope).toBe('read write');
  });

  it('a replayed authorization code is invalid_grant and revokes the grant it minted', async () => {
    const { tokens, code, verifier } = await connect();
    expect((await listCompanies(tokens.access_token)).status).toBe(200);

    const replay = await exchange(code, verifier);
    expect(replay.status).toBe(400);
    expect(await replay.json()).toEqual(expect.objectContaining({ error: 'invalid_grant' }));

    expect((await listCompanies(tokens.access_token)).status).toBe(401);
    const grant = await grantFor(tokens.access_token);
    expect(grant.revoked_reason).toBe('code_replay');
  });

  it('two concurrent exchanges of one code yield exactly one grant', async () => {
    const { code, verifier } = await authorizeCode();
    const responses = await Promise.all([exchange(code, verifier), exchange(code, verifier)]);
    expect(responses.map((r) => r.status).sort()).toEqual([200, 400]);

    const codeRow = await db.query.mcpOAuthAuthorizationCode.findFirst({
      where: eq(mcpOAuthAuthorizationCode.code_hash, hashOAuthSecret(code)),
    });
    const grantsFromCode = await db
      .select({ id: mcpOAuthGrant.id })
      .from(mcpOAuthGrant)
      .where(eq(mcpOAuthGrant.authorization_code_id, codeRow!.id));
    expect(grantsFromCode).toHaveLength(1);
  });

  it('rotates on refresh; reusing the rotated refresh token revokes the grant', async () => {
    const { tokens } = await connect();

    const refreshed = await refresh(tokens.refresh_token);
    expect(refreshed.status).toBe(200);
    const next = (await refreshed.json()) as TokenResponse;
    expect(next.access_token).not.toBe(tokens.access_token);
    expect(next.refresh_token).not.toBe(tokens.refresh_token);
    expect((await listCompanies(tokens.access_token)).status).toBe(401);
    expect((await listCompanies(next.access_token)).status).toBe(200);

    const reuse = await refresh(tokens.refresh_token);
    expect(reuse.status).toBe(400);
    expect(await reuse.json()).toEqual(expect.objectContaining({ error: 'invalid_grant' }));

    // The leaked chain is dead: the newest access and refresh tokens stop working too.
    expect((await listCompanies(next.access_token)).status).toBe(401);
    expect((await refresh(next.refresh_token)).status).toBe(400);
    expect((await grantFor(next.access_token)).revoked_reason).toBe('refresh_reuse');
    expect(await auditEvents('oauth.refresh_reuse')).toHaveLength(1);
  });

  it('refresh past refresh_expires_at or absolute_expires_at is invalid_grant', async () => {
    const pastWindow = await connect();
    const grantA = await grantFor(pastWindow.tokens.access_token);
    await db
      .update(mcpOAuthGrant)
      .set({ refresh_expires_at: new Date(Date.now() - 1000) })
      .where(eq(mcpOAuthGrant.id, grantA.id));
    expect((await refresh(pastWindow.tokens.refresh_token)).status).toBe(400);

    const pastAbsolute = await connect();
    const grantB = await grantFor(pastAbsolute.tokens.access_token);
    await db
      .update(mcpOAuthGrant)
      .set({ absolute_expires_at: new Date(Date.now() - 1000) })
      .where(eq(mcpOAuthGrant.id, grantB.id));
    expect((await refresh(pastAbsolute.tokens.refresh_token)).status).toBe(400);
  });

  it('access tokens expire after 24 h and the client refreshes transparently (clock stub)', async () => {
    const { tokens } = await connect();
    const realNow = Date.now();

    jest.spyOn(Date, 'now').mockReturnValue(realNow + DAY_MS - 60_000);
    expect((await listCompanies(tokens.access_token)).status).toBe(200);

    jest.spyOn(Date, 'now').mockReturnValue(realNow + DAY_MS + 1000);
    const expired = await listCompanies(tokens.access_token);
    expect(expired.status).toBe(401);
    expect(expired.headers.get('www-authenticate')).toContain('invalid_token');

    // What ChatGPT / Claude / Grok do on that 401: refresh and retry.
    const refreshed = await refresh(tokens.refresh_token);
    expect(refreshed.status).toBe(200);
    const next = (await refreshed.json()) as TokenResponse;
    expect((await listCompanies(next.access_token)).status).toBe(200);
  });

  it('tags a tool error from an expired token with the mcp/www_authenticate challenge', async () => {
    const { tokens } = await connect();
    // Transport auth already passed; the grant expires before the tool resolves it.
    const grant = await grantFor(tokens.access_token);
    await db
      .update(mcpOAuthGrant)
      .set({ expires_at: new Date(Date.now() - 60_000) })
      .where(eq(mcpOAuthGrant.id, grant.id));

    const result = await runAgentUserTool(
      'list_companies',
      {
        http: {
          req: new Request(`${ORIGIN}/api/mcp`, {
            headers: { Authorization: `Bearer ${tokens.access_token}` },
          }),
        },
      },
      async () => ({}),
    );

    expect(result.isError).toBe(true);
    const meta = result._meta as Record<string, string[]> | undefined;
    expect(meta?.[MCP_WWW_AUTHENTICATE_META_KEY]).toEqual([
      expect.stringContaining(
        `resource_metadata="${ORIGIN}/.well-known/oauth-protected-resource"`,
      ),
    ]);
    expect(meta?.[MCP_WWW_AUTHENTICATE_META_KEY][0]).toContain('error="invalid_token"');
  });

  it('revokes the token: /api/mcp answers 401 afterwards and refresh fails', async () => {
    const { tokens } = await connect();
    expect((await listCompanies(tokens.access_token)).status).toBe(200);

    const revoke = await revokePost(
      formRequest('/api/oauth/revoke', { token: tokens.access_token }),
    );
    expect(revoke.status).toBe(200);

    expect((await listCompanies(tokens.access_token)).status).toBe(401);
    expect((await refresh(tokens.refresh_token)).status).toBe(400);
    expect((await auditEvents('oauth.grant_revoked')).length).toBeGreaterThan(0);
  });

  it('answers 401 with WWW-Authenticate Basic for an unknown client', async () => {
    const response = await tokenPost(
      formRequest('/api/oauth/token', {
        grant_type: 'refresh_token',
        refresh_token: 'zigzag_refresh_nope',
        client_id: crypto.randomUUID(),
      }),
    );
    expect(response.status).toBe(401);
    expect(response.headers.get('www-authenticate')).toBe('Basic realm="oauth"');
    expect(await response.json()).toEqual(expect.objectContaining({ error: 'invalid_client' }));
  });

  it('DCR rejects custom schemes, plain http and impersonating names; loopback is fine', async () => {
    const register = (body: Record<string, unknown>) =>
      registerPost(jsonRequest('/api/oauth/register', body));

    const customScheme = await register({ redirect_uris: ['myapp://callback'] });
    expect(customScheme.status).toBe(400);
    expect(await customScheme.json()).toEqual(
      expect.objectContaining({ error: 'invalid_redirect_uri' }),
    );

    const plainHttp = await register({ redirect_uris: ['http://evil.example.com/cb'] });
    expect(plainHttp.status).toBe(400);

    const impersonating = await register({
      client_name: 'ChatGPT Connector',
      redirect_uris: ['https://evil.example.com/cb'],
    });
    expect(impersonating.status).toBe(400);
    expect(await impersonating.json()).toEqual(
      expect.objectContaining({ error: 'invalid_client_metadata' }),
    );

    const loopback = await register({
      client_name: 'Local tool',
      redirect_uris: ['http://127.0.0.1:8765/callback', 'http://localhost:9000/cb'],
    });
    expect(loopback.status).toBe(201);
    fixture!.oauthClientIds.push(((await loopback.json()) as { client_id: string }).client_id);
  });
});
