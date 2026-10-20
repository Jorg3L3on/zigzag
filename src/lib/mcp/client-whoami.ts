/**
 * The `Probar` row of each client card in Conexiones: when that client last ran
 * `whoami` successfully for this user, read from the phase-8 activity log.
 * OAuth grants are attributed to a client with `classifyOAuthClient`; API keys
 * are the bearer path, which Conexiones documents for Cursor.
 */
import { and, desc, eq } from 'drizzle-orm';
import { apiKey, mcpOAuthClient, mcpOAuthGrant, mcpToolCall } from '@/db/schema';
import { db } from '@/lib/db';
import { classifyOAuthClient, MCP_CLIENTS, type McpClientId } from '@/lib/mcp-clients';

export type ClientWhoami = {
  /** ISO time of the last successful whoami. */
  at: string;
  /** The connection it came through: the OAuth client name or the key name. */
  connection: string;
};

export type WhoamiByClient = Record<McpClientId, ClientWhoami | null>;

/** How far back to look; older calls are past the 90-day log retention anyway. */
const WHOAMI_SCAN_LIMIT = 200;

export async function lastWhoamiByClient(userId: bigint): Promise<WhoamiByClient> {
  const result = Object.fromEntries(MCP_CLIENTS.map((client) => [client.id, null])) as WhoamiByClient;

  const [grants, keys, calls] = await Promise.all([
    db
      .select({
        id: mcpOAuthGrant.id,
        client_id: mcpOAuthClient.client_id,
        client_name: mcpOAuthClient.client_name,
        redirect_uris: mcpOAuthClient.redirect_uris,
      })
      .from(mcpOAuthGrant)
      .innerJoin(mcpOAuthClient, eq(mcpOAuthGrant.client_id, mcpOAuthClient.client_id))
      .where(eq(mcpOAuthGrant.user_id, userId)),
    db
      .select({ id: apiKey.id, name: apiKey.name })
      .from(apiKey)
      .where(eq(apiKey.user_id, userId)),
    db
      .select({
        api_key_id: mcpToolCall.api_key_id,
        oauth_grant_id: mcpToolCall.oauth_grant_id,
        created_at: mcpToolCall.created_at,
      })
      .from(mcpToolCall)
      .where(
        and(
          eq(mcpToolCall.user_id, userId),
          eq(mcpToolCall.tool, 'whoami'),
          eq(mcpToolCall.ok, true),
        ),
      )
      .orderBy(desc(mcpToolCall.created_at))
      .limit(WHOAMI_SCAN_LIMIT),
  ]);

  const grantClient = new Map(
    grants.map((grant) => [grant.id, { client: classifyOAuthClient(grant), name: grant.client_name }]),
  );
  const keyName = new Map(keys.map((key) => [key.id, key.name]));

  // Calls are newest first, so the first one seen per client wins.
  for (const call of calls) {
    let clientId: McpClientId | null = null;
    let connection = '';
    if (call.oauth_grant_id != null) {
      const grant = grantClient.get(call.oauth_grant_id);
      clientId = grant?.client ?? null;
      connection = grant?.name ?? '';
    } else if (call.api_key_id != null) {
      clientId = 'cursor';
      connection = keyName.get(call.api_key_id) ?? '';
    }
    if (clientId && result[clientId] == null) {
      result[clientId] = { at: call.created_at.toISOString(), connection };
    }
  }
  return result;
}
