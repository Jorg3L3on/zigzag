/**
 * @jest-environment node
 */
import {
  buildAuthorizationServerMetadata,
  buildProtectedResourceMetadata,
  buildWwwAuthenticateChallenge,
} from '@/lib/server/mcp-oauth/metadata';

const STALE_ENV_ORIGIN = 'https://zigzag.vercel.app';
const LIVE_HOST = 'zigzag-hazel.vercel.app';

const buildRequest = (host: string, path = '/.well-known/oauth-protected-resource') =>
  new Request(`https://${host}${path}`, {
    headers: {
      host,
      'x-forwarded-host': host,
      'x-forwarded-proto': 'https',
    },
  });

describe('MCP OAuth well-known metadata', () => {
  const originalNextAuthUrl = process.env.NEXTAUTH_URL;
  const originalAuthUrl = process.env.AUTH_URL;

  beforeEach(() => {
    process.env.NEXTAUTH_URL = STALE_ENV_ORIGIN;
    delete process.env.AUTH_URL;
  });

  afterEach(() => {
    process.env.NEXTAUTH_URL = originalNextAuthUrl;
    if (originalAuthUrl === undefined) {
      delete process.env.AUTH_URL;
    } else {
      process.env.AUTH_URL = originalAuthUrl;
    }
  });

  it('protected resource metadata uses the request origin, not NEXTAUTH_URL', () => {
    const request = buildRequest(LIVE_HOST);
    const metadata = buildProtectedResourceMetadata(request);

    expect(metadata.resource).toBe(`https://${LIVE_HOST}/api/mcp`);
    expect(metadata.authorization_servers).toEqual([`https://${LIVE_HOST}`]);
    expect(JSON.stringify(metadata)).not.toContain('zigzag.vercel.app');
  });

  it('authorization server metadata uses the request origin for all endpoints', () => {
    const request = buildRequest(LIVE_HOST, '/.well-known/oauth-authorization-server');
    const metadata = buildAuthorizationServerMetadata(request);

    expect(metadata.issuer).toBe(`https://${LIVE_HOST}`);
    expect(metadata.authorization_endpoint).toBe(
      `https://${LIVE_HOST}/api/oauth/authorize`,
    );
    expect(metadata.token_endpoint).toBe(`https://${LIVE_HOST}/api/oauth/token`);
    expect(metadata.registration_endpoint).toBe(
      `https://${LIVE_HOST}/api/oauth/register`,
    );
    expect(metadata.revocation_endpoint).toBe(
      `https://${LIVE_HOST}/api/oauth/revoke`,
    );
    expect(JSON.stringify(metadata)).not.toContain('zigzag.vercel.app');
  });

  it('WWW-Authenticate resource_metadata points at the request host', () => {
    const request = buildRequest(LIVE_HOST, '/api/mcp');
    const challenge = buildWwwAuthenticateChallenge(request);

    expect(challenge).toContain(
      `resource_metadata="https://${LIVE_HOST}/.well-known/oauth-protected-resource"`,
    );
    expect(challenge).not.toContain('zigzag.vercel.app');
  });

  it('falls back to NEXTAUTH_URL when no request is available', () => {
    const metadata = buildProtectedResourceMetadata();

    expect(metadata.resource).toBe(`${STALE_ENV_ORIGIN}/api/mcp`);
    expect(metadata.authorization_servers).toEqual([STALE_ENV_ORIGIN]);
  });

  it('falls back to AUTH_URL when NEXTAUTH_URL is unset and no request is available', () => {
    delete process.env.NEXTAUTH_URL;
    process.env.AUTH_URL = 'https://auth.example.test';

    const metadata = buildAuthorizationServerMetadata();

    expect(metadata.issuer).toBe('https://auth.example.test');
    expect(metadata.token_endpoint).toBe(
      'https://auth.example.test/api/oauth/token',
    );
  });
});
