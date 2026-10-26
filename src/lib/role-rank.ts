import { and, eq, inArray, isNull } from 'drizzle-orm';
import { permission, rolePermission } from '@/db/schema';
import { db } from '@/lib/db';

/** Permission names held by each of the given roles (deleted permissions excluded). */
export const loadRolePermissionNames = async (
  roleIds: number[],
): Promise<Map<number, Set<string>>> => {
  const byRole = new Map<number, Set<string>>(roleIds.map((id) => [id, new Set<string>()]));
  if (roleIds.length === 0) {
    return byRole;
  }
  const rows = await db
    .select({ role_id: rolePermission.role_id, name: permission.name })
    .from(rolePermission)
    .innerJoin(permission, eq(permission.id, rolePermission.permission_id))
    .where(and(inArray(rolePermission.role_id, roleIds), isNull(permission.deleted_at)));
  for (const row of rows) {
    byRole.get(row.role_id)?.add(row.name);
  }
  return byRole;
};

/**
 * "Higher role" for team actions (ZIG-I32 review): the target holds a
 * permission the actor lacks. Roles are permission sets, so this is the only
 * order they have; equal or smaller sets are fine.
 */
export const outranks = (target: Set<string>, actor: Set<string>): boolean => {
  for (const name of target) {
    if (!actor.has(name)) {
      return true;
    }
  }
  return false;
};
