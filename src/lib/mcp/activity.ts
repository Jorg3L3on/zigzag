/**
 * Agent activity log (ZIG-I23-8): one `McpToolCall` row per MCP `tools/call`.
 *
 * The runners in `tool-helpers.ts` open a tracker per call, tell it who the
 * agent is and which company it was allowed into, and pass the result through
 * `end`. The insert is fire-and-forget (like `last_used_at`): it never delays
 * the response, and a failed insert never changes or throws into the tool.
 */
import { and, desc, eq, inArray, lt, sql } from 'drizzle-orm';
import { apiKey, company, mcpOAuthClient, mcpOAuthGrant, mcpToolCall } from '@/db/schema';
import { logger } from '@/lib/logger';

export const MCP_TOOL_CALL_RETENTION_DAYS = 90;

export type McpConnectionKind = 'api_key' | 'oauth_grant';

type AgentIdentity = {
  userId: bigint;
  apiKeyId?: number;
  oauthGrantId?: number;
};

type ToolResultLike = {
  isError?: boolean;
  structuredContent?: Record<string, unknown>;
};

export type McpToolCallInsert = typeof mcpToolCall.$inferInsert;

/** The coded error of a phase-2 result (`structuredContent.error.code`). */
export const errorCodeOf = (result: ToolResultLike): string | null => {
  if (!result.isError) return null;
  const error = result.structuredContent?.error;
  if (error && typeof error === 'object' && 'code' in error) {
    const code = (error as { code: unknown }).code;
    if (typeof code === 'string') return code;
  }
  return 'internal';
};

// Unit tests import the runners; never let them write rows to whatever
// DATABASE_URL the test process loaded. Integration tests opt in.
const writesEnabled = () =>
  process.env.NODE_ENV !== 'test' || process.env.MCP_ACTIVITY_TEST_WRITES === '1';

/** Inserts one row; resolves either way and never throws. */
export const recordMcpToolCall = async (row: McpToolCallInsert): Promise<void> => {
  if (!writesEnabled()) return;
  try {
    const { db } = await import('@/lib/db');
    await db.insert(mcpToolCall).values(row);
  } catch (error) {
    logger.warn('mcp tool call not recorded', {
      tool: row.tool,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

/**
 * Tracks one tool call. Without an identity (bad or missing token) nothing is
 * written: the call cannot be shown to anyone.
 */
export const startToolActivity = (tool: string, now: () => number = Date.now) => {
  const startedAt = now();
  let identity: AgentIdentity | null = null;
  let companyId: number | null = null;
  let pending: Promise<void> | null = null;

  return {
    identify(agent: AgentIdentity) {
      identity = agent;
    },
    /** Only once the connection was allowed into the company. */
    company(id: number) {
      companyId = id;
    },
    end<T extends ToolResultLike>(result: T): T {
      try {
        if (identity && !pending) {
          const errorCode = errorCodeOf(result);
          pending = recordMcpToolCall({
            tool,
            user_id: identity.userId,
            api_key_id: identity.apiKeyId ?? null,
            oauth_grant_id: identity.oauthGrantId ?? null,
            company_id: companyId,
            ok: errorCode == null,
            error_code: errorCode,
            duration_ms: Math.max(0, Math.round(now() - startedAt)),
          });
        }
      } catch {
        // The log must never change the tool's response.
      }
      return result;
    },
    /** For tests: the pending insert, if one was started. */
    flush: () => pending ?? Promise.resolve(),
  };
};

export type ToolActivity = ReturnType<typeof startToolActivity>;

/* ------------------------------------------------------------------------- */
/* Reads (Conexiones, /account)                                              */
/* ------------------------------------------------------------------------- */

export const parseConnectionKind = (value: unknown): McpConnectionKind | null =>
  value === 'api_key' || value === 'oauth_grant' ? value : null;

/** The connection's display name when it belongs to the user, else null. */
export async function getOwnedConnection(
  userId: bigint,
  kind: McpConnectionKind,
  connectionId: number,
): Promise<{ id: number; name: string; revoked: boolean } | null> {
  if (!Number.isInteger(connectionId) || connectionId <= 0) return null;
  const { db } = await import('@/lib/db');
  if (kind === 'api_key') {
    const [row] = await db
      .select({ id: apiKey.id, name: apiKey.name, revoked_at: apiKey.revoked_at })
      .from(apiKey)
      .where(and(eq(apiKey.id, connectionId), eq(apiKey.user_id, userId)))
      .limit(1);
    return row ? { id: row.id, name: row.name, revoked: row.revoked_at != null } : null;
  }
  const [row] = await db
    .select({
      id: mcpOAuthGrant.id,
      name: mcpOAuthClient.client_name,
      revoked_at: mcpOAuthGrant.revoked_at,
    })
    .from(mcpOAuthGrant)
    .innerJoin(mcpOAuthClient, eq(mcpOAuthClient.client_id, mcpOAuthGrant.client_id))
    .where(and(eq(mcpOAuthGrant.id, connectionId), eq(mcpOAuthGrant.user_id, userId)))
    .limit(1);
  return row ? { id: row.id, name: row.name, revoked: row.revoked_at != null } : null;
}

export type McpToolCallItem = {
  id: number;
  tool: string;
  company_id: number | null;
  company_name: string | null;
  ok: boolean;
  error_code: string | null;
  duration_ms: number;
  created_at: string;
};

export type McpToolCallPage = {
  items: McpToolCallItem[];
  next_cursor: number | null;
};

const connectionColumn = (kind: McpConnectionKind) =>
  kind === 'api_key' ? mcpToolCall.api_key_id : mcpToolCall.oauth_grant_id;

/**
 * Newest first, `limit` per page; `cursor` is the last id of the previous page.
 * Callers must have checked that the connection belongs to the session user;
 * the user filter is kept as a second guard.
 */
export async function listMcpToolCalls(opts: {
  userId: bigint;
  kind: McpConnectionKind;
  connectionId: number;
  limit?: number;
  cursor?: number | null;
}): Promise<McpToolCallPage> {
  const { db } = await import('@/lib/db');
  const limit = Math.min(Math.max(opts.limit ?? 20, 1), 100);
  const rows = await db
    .select({
      id: mcpToolCall.id,
      tool: mcpToolCall.tool,
      company_id: mcpToolCall.company_id,
      company_name: company.name,
      ok: mcpToolCall.ok,
      error_code: mcpToolCall.error_code,
      duration_ms: mcpToolCall.duration_ms,
      created_at: mcpToolCall.created_at,
    })
    .from(mcpToolCall)
    .leftJoin(company, eq(company.id, mcpToolCall.company_id))
    .where(
      and(
        eq(connectionColumn(opts.kind), opts.connectionId),
        eq(mcpToolCall.user_id, opts.userId),
        opts.cursor ? lt(mcpToolCall.id, opts.cursor) : undefined,
      ),
    )
    .orderBy(desc(mcpToolCall.id))
    .limit(limit + 1);

  const page = rows.slice(0, limit);
  return {
    items: page.map((row) => ({ ...row, created_at: row.created_at.toISOString() })),
    next_cursor: rows.length > limit ? (page[page.length - 1]?.id ?? null) : null,
  };
}

export type LastMcpActivity = {
  tool: string;
  ok: boolean;
  error_code: string | null;
  created_at: string;
};

/** Latest call per connection id, for the `Última actividad` line. */
export async function lastMcpActivityByConnection(
  kind: McpConnectionKind,
  connectionIds: number[],
): Promise<Map<number, LastMcpActivity>> {
  const result = new Map<number, LastMcpActivity>();
  if (connectionIds.length === 0) return result;
  const { db } = await import('@/lib/db');
  const column = connectionColumn(kind);
  const rows = await db
    .selectDistinctOn([column], {
      connection_id: column,
      tool: mcpToolCall.tool,
      ok: mcpToolCall.ok,
      error_code: mcpToolCall.error_code,
      created_at: mcpToolCall.created_at,
    })
    .from(mcpToolCall)
    .where(inArray(column, connectionIds))
    .orderBy(column, desc(mcpToolCall.created_at));

  for (const row of rows) {
    if (row.connection_id == null) continue;
    result.set(row.connection_id, {
      tool: row.tool,
      ok: row.ok,
      error_code: row.error_code,
      created_at: row.created_at.toISOString(),
    });
  }
  return result;
}

/* ------------------------------------------------------------------------- */
/* Retention                                                                 */
/* ------------------------------------------------------------------------- */

/** Deletes rows older than the retention window; returns how many went. */
export async function pruneMcpToolCalls(
  days = MCP_TOOL_CALL_RETENTION_DAYS,
): Promise<number> {
  const { db } = await import('@/lib/db');
  const result = await db
    .delete(mcpToolCall)
    .where(lt(mcpToolCall.created_at, sql`now() - make_interval(days => ${days})`));
  return (result as { rowCount?: number | null }).rowCount ?? 0;
}
