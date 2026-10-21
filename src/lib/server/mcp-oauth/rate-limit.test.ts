/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';

jest.mock('@/lib/server/mcp-oauth/clients', () => ({
  registerDynamicOAuthClient: jest.fn(async () => ({
    client: {
      client_id: 'client-1',
      client_name: 'Rate limit test',
      redirect_uris: ['https://chatgpt.com/cb'],
      grant_types: ['authorization_code'],
      response_types: ['code'],
      token_endpoint_auth_method: 'none',
      client_uri: null,
      logo_uri: null,
    },
    clientSecret: null,
  })),
  resolveOAuthClient: jest.fn(),
  assertRedirectUriAllowed: jest.fn(),
  verifyClientSecret: jest.fn(),
}));

jest.mock('@/lib/server/mcp-oauth/token-attempt-log', () => ({
  finishTokenAttempt: jest.fn(),
  getTokenAttemptPath: jest.fn(() => '/api/oauth/token'),
  sanitizeTokenAttemptBodyFromRecord: jest.fn(() => ({})),
  startTokenAttempt: jest.fn(async () => null),
  updateTokenAttemptBody: jest.fn(),
}));

import { POST as registerPost } from '@/app/api/oauth/register/route';
import { POST as tokenPost } from '@/app/api/oauth/token/route';

const registerRequest = (ip: string) =>
  new NextRequest('http://localhost/api/oauth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-forwarded-for': ip },
    body: JSON.stringify({ redirect_uris: ['https://chatgpt.com/cb'] }),
  });

const tokenRequest = (ip: string) =>
  new NextRequest('http://localhost/api/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-forwarded-for': ip },
    body: JSON.stringify({ grant_type: 'client_credentials' }),
  });

describe('OAuth endpoint rate limits (per IP)', () => {
  it('lets 10 registrations an hour through and answers 429 on the 11th', async () => {
    for (let call = 1; call <= 10; call += 1) {
      expect((await registerPost(registerRequest('203.0.113.10'))).status).toBe(201);
    }

    const limited = await registerPost(registerRequest('203.0.113.10'));
    expect(limited.status).toBe(429);
    expect(limited.headers.get('retry-after')).toBe('3600');
    expect(limited.headers.get('access-control-allow-origin')).toBe('*');
    expect(await limited.json()).toEqual(
      expect.objectContaining({ error: 'too_many_requests' }),
    );

    // Another IP keeps its own window.
    expect((await registerPost(registerRequest('203.0.113.11'))).status).toBe(201);
  });

  it('lets 60 token calls a minute through and answers 429 on the 61st', async () => {
    for (let call = 1; call <= 60; call += 1) {
      expect((await tokenPost(tokenRequest('203.0.113.20'))).status).toBe(400);
    }

    const limited = await tokenPost(tokenRequest('203.0.113.20'));
    expect(limited.status).toBe(429);
    expect(limited.headers.get('retry-after')).toBe('60');
    expect(await limited.json()).toEqual(
      expect.objectContaining({ error: 'too_many_requests' }),
    );

    expect((await tokenPost(tokenRequest('203.0.113.21'))).status).toBe(400);
  });
});
