/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/oauth/consent/route';
import { auth } from '@/lib/auth';
import {
  assertRedirectUriAllowed,
  resolveOAuthClient,
} from '@/lib/server/mcp-oauth/clients';
import { createAuthorizationCode } from '@/lib/server/mcp-oauth/grants';

jest.mock('@/lib/auth', () => ({
  auth: jest.fn(),
}));

jest.mock('@/lib/server/mcp-oauth/clients', () => ({
  resolveOAuthClient: jest.fn(),
  assertRedirectUriAllowed: jest.fn(),
}));

jest.mock('@/lib/server/mcp-oauth/grants', () => ({
  createAuthorizationCode: jest.fn(),
}));

jest.mock('@/lib/server/mcp-oauth/config', () => ({
  getMcpResourceUrl: jest.fn(() => 'https://example.test/mcp'),
  normalizeMcpResourceUrl: jest.fn(() => 'https://example.test/mcp'),
  parseScopeParam: jest.fn((scope?: string) =>
    scope ? scope.split(/\s+/).filter(Boolean) : ['read'],
  ),
}));

const mockAuth = auth as jest.MockedFunction<typeof auth>;
const mockResolveOAuthClient = resolveOAuthClient as jest.MockedFunction<
  typeof resolveOAuthClient
>;
const mockCreateAuthorizationCode =
  createAuthorizationCode as jest.MockedFunction<typeof createAuthorizationCode>;

const CODE_CHALLENGE =
  'eE8NUuiNoV1Dt1KEKA6P16KeU5Rr3Pb36hP3bWFnjUQ';

const REDIRECT_URI = 'https://chatgpt.com/connector/oauth/callback';

const basePayload = {
  client_id: 'test-client',
  redirect_uri: REDIRECT_URI,
  state: 'oauth-state-token',
  scope: 'read write',
  code_challenge: CODE_CHALLENGE,
  code_challenge_method: 'S256' as const,
  allowed_company_ids: ['1'],
  allow_write: 'true',
};

const mockClient = {
  client_id: 'test-client',
  client_name: 'Test Client',
  redirect_uris: [REDIRECT_URI],
  grant_types: ['authorization_code'],
  response_types: ['code'],
  token_endpoint_auth_method: 'none',
  client_uri: null,
  logo_uri: null,
  client_secret_hash: null,
};

const makeJsonRequest = (body: Record<string, unknown>) =>
  new NextRequest('http://localhost/api/oauth/consent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

const makeFormRequest = (fields: Record<string, string | string[]>) => {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    if (Array.isArray(value)) {
      for (const entry of value) form.append(key, entry);
    } else {
      form.append(key, value);
    }
  }
  return new NextRequest('http://localhost/api/oauth/consent', {
    method: 'POST',
    body: form,
  });
};

describe('POST /api/oauth/consent', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuth.mockResolvedValue({
      user: { id: '42' },
    } as Awaited<ReturnType<typeof auth>>);
    mockResolveOAuthClient.mockResolvedValue(mockClient);
    mockCreateAuthorizationCode.mockResolvedValue('mock-auth-code');
  });

  it('returns 200 redirect_to with code and state for JSON POST', async () => {
    const response = await POST(makeJsonRequest(basePayload));

    expect(response.status).toBe(200);
    expect(response.headers.get('Location')).toBeNull();

    const body = (await response.json()) as { redirect_to: string };
    const redirectUrl = new URL(body.redirect_to);

    expect(redirectUrl.origin + redirectUrl.pathname).toBe(REDIRECT_URI);
    expect(redirectUrl.searchParams.get('code')).toBe('mock-auth-code');
    expect(redirectUrl.searchParams.get('state')).toBe('oauth-state-token');
  });

  it('returns 303 Location for form-urlencoded POST (non-JS clients)', async () => {
    const response = await POST(
      makeFormRequest({
        client_id: basePayload.client_id,
        redirect_uri: basePayload.redirect_uri,
        state: basePayload.state,
        scope: basePayload.scope,
        code_challenge: basePayload.code_challenge,
        code_challenge_method: basePayload.code_challenge_method,
        allowed_company_ids: ['1'],
        allow_write: basePayload.allow_write,
      }),
    );

    expect(response.status).toBe(303);
    expect(response.status).not.toBe(307);
    expect(response.status).not.toBe(308);

    const location = response.headers.get('Location');
    expect(location).toBeTruthy();

    const redirectUrl = new URL(location!);
    expect(redirectUrl.searchParams.get('code')).toBe('mock-auth-code');
    expect(redirectUrl.searchParams.get('state')).toBe('oauth-state-token');
  });

  it('returns 401 when session is missing', async () => {
    mockAuth.mockResolvedValue(null);

    const response = await POST(makeJsonRequest(basePayload));

    expect(response.status).toBe(401);
    expect(mockCreateAuthorizationCode).not.toHaveBeenCalled();
  });
});
