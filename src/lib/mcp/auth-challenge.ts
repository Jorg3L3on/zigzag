import { buildInvalidTokenChallenge } from '@/lib/server/mcp-oauth/metadata';

/** `_meta` key ChatGPT reads on a tool error to re-run the OAuth flow. */
export const MCP_WWW_AUTHENTICATE_META_KEY = 'mcp/www_authenticate';

/**
 * A token can pass transport auth and then expire or be revoked before the tool
 * resolves it. The 401 tool error carries the WWW-Authenticate challenge (as an
 * array, the shape the Apps SDK documents) so the client re-prompts for auth
 * instead of showing a dead error.
 */
export const authChallengeMeta = (
  description: string,
  request?: Request,
): Record<string, string[]> => ({
  [MCP_WWW_AUTHENTICATE_META_KEY]: [buildInvalidTokenChallenge(description, request)],
});
