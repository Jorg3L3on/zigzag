import { inArray } from 'drizzle-orm';
import { user } from '@/db/schema';
import { db } from '@/lib/db';

/**
 * Resolve display names for audit actor user ids.
 * Soft-deleted users are still included so historical activity stays labeled.
 * Server-only — do not import from Client Components.
 */
export const resolveActorNames = async (
  actorIds: Array<string | null | undefined>,
): Promise<Map<string, string>> => {
  const unique = [
    ...new Set(
      actorIds
        .map((id) => id?.trim())
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const map = new Map<string, string>();
  if (unique.length === 0) {
    return map;
  }

  const rows = await db
    .select({ id: user.id, name: user.name })
    .from(user)
    .where(
      inArray(
        user.id,
        unique.map((id) => BigInt(id)),
      ),
    );

  for (const row of rows) {
    map.set(String(row.id), row.name);
  }
  return map;
};

export { actorDisplayName } from '@/lib/audit-actor-display';
