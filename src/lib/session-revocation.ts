import { eq, sql } from 'drizzle-orm';
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
