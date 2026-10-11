import { and, eq, isNull } from 'drizzle-orm';
import { user } from '@/db/schema';
import { db } from '@/lib/db';

/** Whether this user still has to replace a temporary password (ZIG-I18-11). */
export const isPasswordChangePending = async (userId: string): Promise<boolean> => {
  const row = await db.query.user.findFirst({
    where: and(eq(user.id, BigInt(userId)), isNull(user.deleted_at)),
    columns: { must_change_password: true },
  });
  return Boolean(row?.must_change_password);
};
