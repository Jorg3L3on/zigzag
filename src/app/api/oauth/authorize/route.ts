import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import {
  assertRedirectUriAllowed,
  isUnknownCimdClientId,
  resolveOAuthClient,
} from '@/lib/server/mcp-oauth/clients';
import {
  enforceOAuthRateLimit,
  OAUTH_CIMD_RESOLVE_RATE_LIMIT,
} from '@/lib/server/mcp-oauth/rate-limit';
import {
  getMcpResourceUrl,
  mcpResourcesMatch,
  normalizeMcpResourceUrl,
  parseScopeParam,
} from '@/lib/server/mcp-oauth/config';
import { createAuthorizationCode } from '@/lib/server/mcp-oauth/grants';
import { oauthErrorResponse, oauthOptionsResponse, withOAuthCors } from '@/lib/server/mcp-oauth/cors';
import { LOGIN_PATH } from '@/lib/login-redirect';

const requiredParams = [
  'response_type',
  'client_id',
  'redirect_uri',
  'code_challenge',
  'code_challenge_method',
] as const;

export function OPTIONS() {
  return oauthOptionsResponse();
}

export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const missing = requiredParams.filter((param) => !url.searchParams.get(param));
  if (missing.length > 0) {
    return oauthErrorResponse(
      'invalid_request',
      `Faltan parámetros: ${missing.join(', ')}`,
    );
  }

  const responseType = url.searchParams.get('response_type');
  if (responseType !== 'code') {
    return oauthErrorResponse(
      'unsupported_response_type',
      'Solo se admite response_type=code',
    );
  }

  const codeChallengeMethod = url.searchParams.get('code_challenge_method');
  if (codeChallengeMethod !== 'S256') {
    return oauthErrorResponse(
      'invalid_request',
      'Solo se admite code_challenge_method=S256',
    );
  }

  const clientId = url.searchParams.get('client_id')!;
  const redirectUri = url.searchParams.get('redirect_uri')!;
  if (await isUnknownCimdClientId(clientId)) {
    const limited = await enforceOAuthRateLimit(
      'cimd-resolve',
      request,
      OAUTH_CIMD_RESOLVE_RATE_LIMIT,
    );
    if (limited) return limited;
  }
  const client = await resolveOAuthClient(clientId);
  if (!client) {
    return oauthErrorResponse('invalid_client', 'Cliente OAuth desconocido');
  }

  try {
    assertRedirectUriAllowed(client, redirectUri);
  } catch {
    return oauthErrorResponse('invalid_request', 'redirect_uri no autorizado');
  }

  // RFC 8707: this server only issues tokens for its own MCP resource.
  const mcpResource = getMcpResourceUrl(request);
  const requestedResource = url.searchParams.get('resource');
  if (requestedResource && !mcpResourcesMatch(requestedResource, mcpResource, request)) {
    const errorRedirect = new URL(redirectUri);
    errorRedirect.searchParams.set('error', 'invalid_target');
    errorRedirect.searchParams.set(
      'error_description',
      'resource debe ser la URL del servidor MCP de ZigZag',
    );
    const state = url.searchParams.get('state');
    if (state) errorRedirect.searchParams.set('state', state);
    return withOAuthCors(Response.redirect(errorRedirect));
  }

  const session = await auth();
  if (!session?.user?.id) {
    const callback = `${url.pathname}${url.search}`;
    const loginUrl = new URL(LOGIN_PATH, url.origin);
    loginUrl.searchParams.set('callbackUrl', callback);
    return withOAuthCors(Response.redirect(loginUrl));
  }

  const consentUrl = new URL('/oauth/consent', url.origin);
  for (const [key, value] of url.searchParams.entries()) {
    consentUrl.searchParams.set(key, value);
  }
  const resource = normalizeMcpResourceUrl(requestedResource ?? mcpResource, request);
  consentUrl.searchParams.set('resource', resource);

  return withOAuthCors(Response.redirect(consentUrl));
}
