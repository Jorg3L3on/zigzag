import { and, eq, lt, or, type AnyColumn, type SQL } from 'drizzle-orm';
import { McpToolError } from '@/lib/mcp/tool-helpers';

/**
 * Keyset cursor shared by every paged MCP list (ZIG-I23-4): base64url of
 * `created_at,id`, for lists ordered by `created_at DESC, id DESC`. Opaque to
 * the model; it only hands back the `next_cursor` it was given.
 */

export type ListCursor = { createdAt: Date; id: string };

const INVALID_CURSOR = 'cursor inválido: usa el next_cursor de la respuesta anterior.';

export const encodeCursor = (row: { created_at: Date; id: number | bigint | string }): string =>
  Buffer.from(`${row.created_at.toISOString()},${String(row.id)}`, 'utf8').toString(
    'base64url',
  );

export const decodeCursor = (cursor: string): ListCursor => {
  const decoded = Buffer.from(cursor, 'base64url').toString('utf8');
  const comma = decoded.lastIndexOf(',');
  if (comma <= 0) throw new McpToolError('validation', INVALID_CURSOR);
  const createdAt = new Date(decoded.slice(0, comma));
  const id = decoded.slice(comma + 1);
  if (Number.isNaN(createdAt.getTime()) || !/^\d+$/.test(id)) {
    throw new McpToolError('validation', INVALID_CURSOR);
  }
  return { createdAt, id };
};

/** `WHERE (created_at, id) < (cursor)` for a `created_at DESC, id DESC` order. */
export const afterCursor = (
  columns: { createdAt: AnyColumn; id: AnyColumn },
  cursor: string | undefined,
): SQL | undefined => {
  if (!cursor) return undefined;
  const { createdAt, id } = decodeCursor(cursor);
  return or(
    lt(columns.createdAt, createdAt),
    and(eq(columns.createdAt, createdAt), lt(columns.id, id)),
  );
};

/** Rows fetched with `limit + 1` → the page plus the cursor of its last row. */
export const toPage = <T extends { created_at: Date; id: number | bigint | string }>(
  rows: T[],
  limit: number,
): { items: T[]; nextCursor: string | null } => {
  if (rows.length <= limit) return { items: rows, nextCursor: null };
  const items = rows.slice(0, limit);
  return { items, nextCursor: encodeCursor(items[items.length - 1]) };
};

export const clampListLimit = (limit: number | undefined, fallback = 50): number =>
  Math.min(Math.max(limit ?? fallback, 1), 100);

/** `%query%` for ILIKE, with the LIKE wildcards in the query escaped. */
export const toLikePattern = (query: string): string =>
  `%${query.trim().replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
