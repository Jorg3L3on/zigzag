/**
 * @jest-environment node
 *
 * The whole OAuth 2.1 connector flow against a local Postgres, the way ChatGPT
 * runs it: DCR → authorize → consent → token (PKCE S256 + resource) → bearer on
 * /api/mcp → refresh rotates → revoke kills it. Skipped unless DATABASE_URL
 * points at localhost (see src/test/mcp-db-fixtures.ts).
 */
import crypto from 'node:crypto';
import { eq } from 'drizzle-orm';
import { NextRequest } from 'next/server';
import { mcpOAuthGrant } from '@/db/schema';
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

const ORIGIN = 'http://localhost:3072';
const REDIRECT_URI = 'https://chatgpt.com/connector_platform_oauth_redirect';
const mockAuth = auth as jest.MockedFunction<typeof auth>;

const base64url = (buffer: Buffer) => buffer.toString('base64url');

const formRequest = (path: string, fields: Record<string, string>) =>
  new NextRequest(`${ORIGIN}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(fields).toString(),
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
  let tokens: TokenResponse | null = null;

  beforeAll(async () => {
    fixture = await createMcpDbFixture('oauth-flow');
    mockAuth.mockResolvedValue({
      user: { id: String(fixture.userId) },
    } as Awaited<ReturnType<typeof auth>>);
  });

  afterAll(async () => {
    await cleanupMcpDbFixture(fixture);
    await closeTestDbPool();
  });

  it('registers, authorizes, consents and exchanges the code with PKCE and resource', async () => {
    const registration = await registerPost(
      new NextRequest(`${ORIGIN}/api/oauth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_name: 'Jest flow', redirect_uris: [REDIRECT_URI] }),
      }),
    );
    expect(registration.status).toBe(201);
    const client = (await registration.json()) as { client_id: string };
    clientId = client.client_id;
    fixture!.oauthClientIds.push(clientId);

    const verifier = base64url(crypto.randomBytes(32));
    const challenge = base64url(crypto.createHash('sha256').update(verifier).digest());
    const authorizeParams = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: REDIRECT_URI,
      code_challenge: challenge,
      code_challenge_method: 'S256',
      scope: 'read',
      state: 'jest-state',
      resource: `${ORIGIN}/mcp`,
    });
    const authorize = await authorizeGet(
      new NextRequest(`${ORIGIN}/api/oauth/authorize?${authorizeParams}`),
    );
    expect([302, 303, 307]).toContain(authorize.status);
    const consentUrl = new URL(authorize.headers.get('location')!);
    expect(consentUrl.pathname).toBe('/oauth/consent');
    expect(consentUrl.searchParams.get('client_id')).toBe(clientId);
    // The /mcp alias normalises to the canonical resource.
    expect(consentUrl.searchParams.get('resource')).toBe(`${ORIGIN}/api/mcp`);

    const consent = await consentPost(
      new NextRequest(`${ORIGIN}/api/oauth/consent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: clientId,
          redirect_uri: REDIRECT_URI,
          state: 'jest-state',
          scope: 'read',
          code_challenge: challenge,
          code_challenge_method: 'S256',
          resource: consentUrl.searchParams.get('resource'),
          allowed_company_ids: [String(fixture!.companyId)],
          allow_write: 'false',
        }),
      }),
    );
    expect(consent.status).toBe(200);
    const callback = new URL(((await consent.json()) as { redirect_to: string }).redirect_to);
    expect(callback.searchParams.get('state')).toBe('jest-state');
    const code = callback.searchParams.get('code')!;
    expect(code).toBeTruthy();

    const token = await tokenPost(
      formRequest('/api/oauth/token', {
        grant_type: 'authorization_code',
        code,
        redirect_uri: REDIRECT_URI,
        client_id: clientId,
        code_verifier: verifier,
        resource: `${ORIGIN}/mcp`,
      }),
    );
    expect(token.status).toBe(200);
    tokens = (await token.json()) as TokenResponse;
    expect(tokens.token_type).toBe('bearer');
    expect(tokens.scope).toBe('read');
    expect(tokens.access_token).toMatch(/^zigzag_oauth_/);

    const replay = await tokenPost(
      formRequest('/api/oauth/token', {
        grant_type: 'authorization_code',
        code,
        redirect_uri: REDIRECT_URI,
        client_id: clientId,
        code_verifier: verifier,
      }),
    );
    expect(replay.status).toBe(400);
  });

  it('accepts the access token on /api/mcp', async () => {
    const response = await listCompanies(tokens!.access_token);
    expect(response.status).toBe(200);
    const result = (await readMcpJsonRpc(response)).result;
    expect(result.isError).toBeFalsy();
    expect(JSON.parse(result.content[0].text).companies).toEqual([
      expect.objectContaining({ id: fixture!.companyId }),
    ]);
  });

  it('rotates tokens on refresh: the old access token stops working', async () => {
    const refreshed = await tokenPost(
      formRequest('/api/oauth/token', {
        grant_type: 'refresh_token',
        refresh_token: tokens!.refresh_token,
        client_id: clientId,
        resource: `${ORIGIN}/api/mcp`,
      }),
    );
    expect(refreshed.status).toBe(200);
    const next = (await refreshed.json()) as TokenResponse;
    expect(next.access_token).not.toBe(tokens!.access_token);
    expect(next.refresh_token).not.toBe(tokens!.refresh_token);

    expect((await listCompanies(tokens!.access_token)).status).toBe(401);
    expect((await listCompanies(next.access_token)).status).toBe(200);

    const reuse = await tokenPost(
      formRequest('/api/oauth/token', {
        grant_type: 'refresh_token',
        refresh_token: tokens!.refresh_token,
        client_id: clientId,
      }),
    );
    expect(reuse.status).toBe(400);
    tokens = next;
  });

  it('tags a tool error from an expired token with the mcp/www_authenticate challenge', async () => {
    // Transport auth already passed; the grant expires before the tool resolves it.
    await db
      .update(mcpOAuthGrant)
      .set({ expires_at: new Date(Date.now() - 60_000) })
      .where(eq(mcpOAuthGrant.client_id, clientId));

    const result = await runAgentUserTool(
      'list_companies',
      {
        http: {
          req: new Request(`${ORIGIN}/api/mcp`, {
            headers: { Authorization: `Bearer ${tokens!.access_token}` },
          }),
        },
      },
      async () => ({}),
    );

    expect(result.isError).toBe(true);
    const meta = (result as { _meta?: Record<string, string[]> })._meta;
    expect(meta?.[MCP_WWW_AUTHENTICATE_META_KEY]).toEqual([
      expect.stringContaining(
        `resource_metadata="${ORIGIN}/.well-known/oauth-protected-resource"`,
      ),
    ]);
    expect(meta?.[MCP_WWW_AUTHENTICATE_META_KEY][0]).toContain('error="invalid_token"');

    await db
      .update(mcpOAuthGrant)
      .set({ expires_at: new Date(Date.now() + 60 * 60 * 1000) })
      .where(eq(mcpOAuthGrant.client_id, clientId));
  });

  it('revokes the token: /api/mcp answers 401 afterwards', async () => {
    expect((await listCompanies(tokens!.access_token)).status).toBe(200);

    const revoke = await revokePost(
      formRequest('/api/oauth/revoke', { token: tokens!.access_token }),
    );
    expect(revoke.status).toBe(200);

    expect((await listCompanies(tokens!.access_token)).status).toBe(401);

    const refreshAfterRevoke = await tokenPost(
      formRequest('/api/oauth/token', {
        grant_type: 'refresh_token',
        refresh_token: tokens!.refresh_token,
        client_id: clientId,
      }),
    );
    expect(refreshAfterRevoke.status).toBe(400);
  });
});
