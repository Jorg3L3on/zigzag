import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';
import { resolveAgentUser } from '@/lib/server/resolve-agent-context';

/** Bearer verifier for MCP transport auth. Accepts API keys and OAuth access tokens. */
export async function verifyMcpBearerToken(
  _request: Request,
  bearerToken?: string,
): Promise<AuthInfo | undefined> {
  if (!bearerToken?.trim()) return undefined;

  try {
    const agent = await resolveAgentUser(bearerToken);
    return {
      token: bearerToken,
      clientId:
        agent.authSource === 'oauth_grant'
          ? `oauth-grant:${agent.oauthGrantId}`
          : `api-key:${agent.apiKeyId}`,
      scopes: agent.scopes,
    };
  } catch {
    return undefined;
  }
}
