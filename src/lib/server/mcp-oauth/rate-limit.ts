import { getClientIpFromHeaders } from '@/lib/audit-request-meta';
import { checkRateLimit, type RateLimitOptions } from '@/lib/rate-limiter';
import { oauthJsonResponse } from '@/lib/server/mcp-oauth/cors';

/** Dynamic client registration: 10 per hour per IP. */
export const OAUTH_REGISTER_RATE_LIMIT: RateLimitOptions = {
  limit: 10,
  windowMs: 60 * 60 * 1000,
};

/** Token endpoint: 60 per minute per IP. */
export const OAUTH_TOKEN_RATE_LIMIT: RateLimitOptions = {
  limit: 60,
  windowMs: 60 * 1000,
};

/**
 * New CIMD client_ids: 20 per hour per IP. Each one makes us fetch a URL the
 * caller chose and store a client row (same limit as micasa).
 */
export const OAUTH_CIMD_RESOLVE_RATE_LIMIT: RateLimitOptions = {
  limit: 20,
  windowMs: 60 * 60 * 1000,
};

/**
 * Per-IP fixed window for the public OAuth endpoints. Returns the 429 to send,
 * or null when the call is within the limit.
 */
export const enforceOAuthRateLimit = async (
  bucket: 'register' | 'token' | 'cimd-resolve',
  request: Request,
  options: RateLimitOptions,
): Promise<Response | null> => {
  const ip = getClientIpFromHeaders(request.headers) ?? 'unknown';
  const allowed = await checkRateLimit(`oauth:${bucket}:${ip}`, options);
  if (allowed) return null;
  return oauthJsonResponse(
    {
      error: 'too_many_requests',
      error_description: 'Demasiadas solicitudes. Reintenta más tarde.',
    },
    {
      status: 429,
      headers: { 'Retry-After': String(Math.ceil(options.windowMs / 1000)) },
    },
  );
};
