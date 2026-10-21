/** @jest-environment node */
import { McpToolError } from '@/lib/mcp/tool-helpers';
import {
  clampListLimit,
  decodeCursor,
  encodeCursor,
  toLikePattern,
  toPage,
} from '@/lib/mcp/cursor';

// tool-helpers imports the agent resolver, which pulls in next-auth (ESM).
jest.mock('@/lib/server/resolve-agent-context', () => ({ AgentAuthError: class extends Error {} }));

jest.mock('@/lib/logger', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}));

const at = (iso: string) => new Date(iso);

describe('cursor', () => {
  it('round-trips created_at and id', () => {
    const cursor = encodeCursor({ created_at: at('2026-01-10T08:00:00.123Z'), id: 42 });
    expect(decodeCursor(cursor)).toEqual({
      createdAt: at('2026-01-10T08:00:00.123Z'),
      id: '42',
    });
  });

  it('keeps BigInt ids exact', () => {
    const cursor = encodeCursor({ created_at: at('2026-01-10T08:00:00Z'), id: 9007199254740993n });
    expect(decodeCursor(cursor).id).toBe('9007199254740993');
  });

  it.each(['', 'not-base64', Buffer.from('2026-01-10,abc').toString('base64url'), Buffer.from('nope,1').toString('base64url')])(
    'rejects %p as a validation error',
    (cursor) => {
      expect(() => decodeCursor(cursor)).toThrow(McpToolError);
      try {
        decodeCursor(cursor);
      } catch (error) {
        expect((error as McpToolError).code).toBe('validation');
      }
    },
  );

  it('toPage returns the cursor of the last row only when there is more', () => {
    const rows = [1, 2, 3].map((id) => ({ id, created_at: at(`2026-01-0${id}T00:00:00Z`) }));
    expect(toPage(rows, 3)).toEqual({ items: rows, nextCursor: null });
    const page = toPage(rows, 2);
    expect(page.items).toEqual(rows.slice(0, 2));
    expect(decodeCursor(page.nextCursor!)).toEqual({ createdAt: rows[1].created_at, id: '2' });
  });

  it('clamps the limit to 1-100 with a default of 50', () => {
    expect(clampListLimit(undefined)).toBe(50);
    expect(clampListLimit(0)).toBe(1);
    expect(clampListLimit(500)).toBe(100);
  });

  it('escapes LIKE wildcards in the query', () => {
    expect(toLikePattern(' 50%_off\\ ')).toBe('%50\\%\\_off\\\\%');
  });
});
