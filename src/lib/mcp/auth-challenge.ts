import { buildInvalidTokenChallenge } from '@/lib/server/mcp-oauth/metadata';
import { AgentAuthError } from '@/lib/server/resolve-agent-context';

/** `_meta` key ChatGPT reads on a tool error to re-run the OAuth flow. */
export const MCP_WWW_AUTHENTICATE_META_KEY = 'mcp/www_authenticate';

/**
 * A token can pass transport auth and then expire or be revoked before the tool
 * resolves it. Tag that 401 tool error with the WWW-Authenticate challenge (as an
 * array, the shape the Apps SDK documents) so the client re-prompts for auth
 * instead of showing a dead error.
 */
export const withAuthChallenge = <T extends object>(
  result: T,
  error: unknown,
  request?: Request,
): T | (T & { _meta: Record<string, string[]> }) => {
  if (!(error instanceof AgentAuthError) || error.status !== 401) return result;
  return {
    ...result,
    _meta: {
      [MCP_WWW_AUTHENTICATE_META_KEY]: [
        buildInvalidTokenChallenge(error.message, request),
      ],
    },
  };
};
