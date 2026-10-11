import { and, eq, isNull, sql } from 'drizzle-orm';
import { user } from '@/db/schema';
import { db } from '@/lib/db';

/**
 * Invalidate all existing JWT sessions for a user by incrementing their
 * `token_version`. Subsequent requests carrying an older version fail session
 * validation in requireActionAuth / requireSession. Call after password
 * changes, role changes, or soft-deletes.
 */
export const bumpUserTokenVersion = async (userId: bigint): Promise<void> => {
  await db
    .update(user)
    .set({
      token_version: sql`${user.token_version} + 1`,
      updated_at: new Date(),
    })
    .where(eq(user.id, userId));
};

/**
 * True when a signed-in session is still the current one: the user exists and
 * the token carries their current `token_version`. A revoked JWT still decodes,
 * so anything that sends signed-in people away from /login must check this
 * first or it loops (login → dashboard → expired → login).
 */
export const isSessionCurrent = async (
  session: { user?: { id?: string; token_version?: number } } | null | undefined,
): Promise<boolean> => {
  const userId = session?.user?.id;
  if (!userId) return false;
  try {
    const row = await db.query.user.findFirst({
      where: and(eq(user.id, BigInt(userId)), isNull(user.deleted_at)),
      columns: { token_version: true },
    });
    if (!row) return false;
    return (session?.user?.token_version ?? 0) === (row.token_version ?? 0);
  } catch {
    return false;
  }
};
