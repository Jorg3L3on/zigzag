import type { AgentScope } from '@/lib/server/resolve-agent-context';

export const MCP_OAUTH_SCOPES: AgentScope[] = ['read', 'write'];

export const MCP_RESOURCE_PATH = '/api/mcp';

/** ChatGPT may use origin + /mcp instead of /api/mcp (RFC 9728 path-aware discovery). */
export const MCP_RESOURCE_ALIAS_PATH = '/mcp';

export const OAUTH_ACCESS_TOKEN_PREFIX = 'zigzag_oauth_';

export const OAUTH_REFRESH_TOKEN_PREFIX = 'zigzag_refresh_';

export const OAUTH_CODE_TTL_MS = 10 * 60 * 1000;

export const OAUTH_ACCESS_TOKEN_TTL_MS = 90 * 24 * 60 * 60 * 1000;

export const OAUTH_REFRESH_TOKEN_TTL_MS = 365 * 24 * 60 * 60 * 1000;

export const OAUTH_TOKEN_LOOKUP_LENGTH = 20;

const trimTrailingSlash = (value: string): string =>
  value.endsWith('/') ? value.slice(0, -1) : value;

const getOAuthIssuerFromEnv = (): string | null => {
  const fromEnv =
    process.env.NEXTAUTH_URL?.trim() ?? process.env.AUTH_URL?.trim();
  return fromEnv ? trimTrailingSlash(fromEnv) : null;
};

const getOAuthIssuerFromRequest = (request: Request): string | null => {
  try {
    const url = new URL(request.url);
    if (url.host) {
      return trimTrailingSlash(`${url.protocol}//${url.host}`);
    }
  } catch {
    // fall through to forwarded headers
  }

  const host =
    request.headers.get('x-forwarded-host') ?? request.headers.get('host');
  const proto =
    request.headers.get('x-forwarded-proto') ??
    (host?.includes('localhost') ? 'http' : 'https');
  if (host) return trimTrailingSlash(`${proto}://${host}`);

  return null;
};

/**
 * Canonical OAuth issuer / public origin for MCP metadata and endpoints.
 * Prefers the incoming request Host so production aliases (e.g. zigzag-hazel.vercel.app)
 * match what the client called. Falls back to NEXTAUTH_URL or AUTH_URL when no request
 * is available (SSR, scripts). See docs/mcp-connector.md.
 */
export const getOAuthIssuer = (request?: Request): string => {
  if (request) {
    const fromRequest = getOAuthIssuerFromRequest(request);
    if (fromRequest) return fromRequest;
  }

  const fromEnv = getOAuthIssuerFromEnv();
  if (fromEnv) return fromEnv;

  return 'http://localhost:3069';
};

export const getMcpResourceUrl = (request?: Request): string =>
  `${getOAuthIssuer(request)}${MCP_RESOURCE_PATH}`;

const normalizePath = (pathname: string): string => {
  const trimmed = pathname.replace(/\/$/, '');
  return trimmed.length > 0 ? trimmed : '/';
};

export const normalizeMcpResourceUrl = (
  resource: string,
  request?: Request,
): string => {
  try {
    const url = new URL(resource);
    const issuer = new URL(getOAuthIssuer(request));
    const path = normalizePath(url.pathname);
    if (
      url.origin === issuer.origin &&
      (path === MCP_RESOURCE_PATH || path === MCP_RESOURCE_ALIAS_PATH)
    ) {
      return `${issuer.origin}${MCP_RESOURCE_PATH}`;
    }
    return resource;
  } catch {
    return resource;
  }
};

export const mcpResourcesMatch = (
  a: string,
  b: string,
  request?: Request,
): boolean =>
  normalizeMcpResourceUrl(a, request) === normalizeMcpResourceUrl(b, request);

export const oauthPath = (request: Request | undefined, path: string): string =>
  `${getOAuthIssuer(request)}${path}`;

export const buildOAuthTokenAudiences = (request?: Request): string[] => {
  const issuer = getOAuthIssuer(request);
  const resource = getMcpResourceUrl(request);
  const aliasResource = `${issuer}${MCP_RESOURCE_ALIAS_PATH}`;
  const candidates = [
    oauthPath(request, '/api/oauth/token'),
    oauthPath(request, '/oauth/token'),
    oauthPath(request, '/token'),
    issuer,
    `${issuer}/token`,
    resource,
    aliasResource,
  ];
  return [...new Set(candidates.map(trimTrailingSlash))];
};

export const parseScopeParam = (scope: string | null | undefined): AgentScope[] => {
  if (!scope?.trim()) return ['read'];
  const parsed = scope
    .split(/[\s+]+/)
    .filter((value): value is AgentScope => value === 'read' || value === 'write');
  if (!parsed.includes('read')) parsed.unshift('read');
  return [...new Set(parsed)];
};

export const scopesToParam = (scopes: AgentScope[]): string =>
  [...new Set(scopes)].join(' ');
