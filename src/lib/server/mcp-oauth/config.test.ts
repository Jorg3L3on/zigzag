/**
 * @jest-environment node
 */
import {
  getMcpResourceUrl,
  getOAuthIssuer,
  mcpResourcesMatch,
  normalizeMcpResourceUrl,
} from '@/lib/server/mcp-oauth/config';

const STALE_ENV_ORIGIN = 'https://zigzag.vercel.app';
const LIVE_HOST = 'zigzag-hazel.vercel.app';

const buildRequest = (host: string) =>
  new Request(`https://${host}/api/oauth/token`, {
    headers: {
      host,
      'x-forwarded-host': host,
      'x-forwarded-proto': 'https',
    },
  });

describe('MCP OAuth issuer and resource URL', () => {
  const originalNextAuthUrl = process.env.NEXTAUTH_URL;

  beforeEach(() => {
    process.env.NEXTAUTH_URL = STALE_ENV_ORIGIN;
  });

  afterEach(() => {
    process.env.NEXTAUTH_URL = originalNextAuthUrl;
  });

  it('getOAuthIssuer prefers request host over NEXTAUTH_URL', () => {
    const request = buildRequest(LIVE_HOST);
    expect(getOAuthIssuer(request)).toBe(`https://${LIVE_HOST}`);
    expect(getMcpResourceUrl(request)).toBe(`https://${LIVE_HOST}/api/mcp`);
  });

  it('normalizeMcpResourceUrl canonicalizes /mcp alias on the request origin', () => {
    const request = buildRequest(LIVE_HOST);
    expect(
      normalizeMcpResourceUrl(`https://${LIVE_HOST}/mcp`, request),
    ).toBe(`https://${LIVE_HOST}/api/mcp`);
  });

  it('mcpResourcesMatch treats /mcp and /api/mcp as equivalent on the request origin', () => {
    const request = buildRequest(LIVE_HOST);
    expect(
      mcpResourcesMatch(
        `https://${LIVE_HOST}/mcp`,
        `https://${LIVE_HOST}/api/mcp`,
        request,
      ),
    ).toBe(true);
  });

  it('does not treat stale env origin as equivalent to the live request host', () => {
    const request = buildRequest(LIVE_HOST);
    expect(
      mcpResourcesMatch(
        `${STALE_ENV_ORIGIN}/api/mcp`,
        `https://${LIVE_HOST}/api/mcp`,
        request,
      ),
    ).toBe(false);
  });
});
