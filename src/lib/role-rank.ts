import { and, eq, inArray, isNull } from 'drizzle-orm';
import { permission, rolePermission, user } from '@/db/schema';
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

type GuardActor = { userId: string; companyIsSystem: boolean };

const actorRoleId = async (actorUserId: string): Promise<number | null> => {
  const row = await db.query.user.findFirst({
    where: eq(user.id, BigInt(actorUserId)),
    columns: { role_id: true },
  });
  return row?.role_id ?? null;
};

/**
 * The one guard for writes to another person's role or password (ZIG-I32
 * review). Tenants only; system operators are exempt as before.
 * - US009: nobody changes their own role.
 * - US010: no role or password change and no deactivation on someone whose
 *   role holds a permission the actor lacks, and no assigning a role that does.
 * `target` is null when creating; `nextRoleId` undefined means the role is
 * not being set.
 */
export async function guardUserWrite(input: {
  actor: GuardActor;
  target: { id: bigint; role_id: number | null } | null;
  nextRoleId?: number | null;
  setsPassword?: boolean;
  /** deleteUser / deactivateTeamMember: taking someone's access away. */
  deactivates?: boolean;
}): Promise<'US009' | 'US010' | null> {
  const { actor, target, nextRoleId, setsPassword = false, deactivates = false } = input;
  if (actor.companyIsSystem) {
    return null;
  }
  const roleChanges =
    nextRoleId !== undefined && (target === null || (nextRoleId ?? null) !== target.role_id);
  if (target && String(target.id) === actor.userId && roleChanges) {
    return 'US009';
  }
  if (!roleChanges && !setsPassword && !deactivates) {
    return null;
  }
  const actorRole = await actorRoleId(actor.userId);
  const roleIds = [actorRole, target?.role_id ?? null, roleChanges ? (nextRoleId ?? null) : null]
    .filter((id): id is number => id !== null);
  const permissions = await loadRolePermissionNames(Array.from(new Set(roleIds)));
  const held = (id: number | null) => (id === null ? new Set<string>() : (permissions.get(id) ?? new Set<string>()));
  const mine = held(actorRole);
  if (target && String(target.id) !== actor.userId && outranks(held(target.role_id), mine)) {
    return 'US010';
  }
  if (roleChanges && nextRoleId != null && outranks(held(nextRoleId), mine)) {
    return 'US010';
  }
  return null;
}

/**
 * Role edits by a tenant (ZIG-I32 review): a role may only hold permissions
 * the actor holds, and a role that already holds more cannot be edited, so
 * nobody grants themselves or others what they do not have (RL007).
 */
export async function guardRoleGrant(input: {
  actor: GuardActor;
  permissionIds: number[];
  currentRoleId?: number | null;
}): Promise<'RL007' | null> {
  const { actor, permissionIds, currentRoleId } = input;
  if (actor.companyIsSystem) {
    return null;
  }
  const actorRole = await actorRoleId(actor.userId);
  const roleIds = [actorRole, currentRoleId ?? null].filter((id): id is number => id !== null);
  const permissions = await loadRolePermissionNames(Array.from(new Set(roleIds)));
  const mine = actorRole === null ? new Set<string>() : (permissions.get(actorRole) ?? new Set<string>());
  const granted =
    permissionIds.length === 0
      ? []
      : await db
          .select({ name: permission.name })
          .from(permission)
          .where(inArray(permission.id, permissionIds));
  if (outranks(new Set(granted.map((row) => row.name)), mine)) {
    return 'RL007';
  }
  if (currentRoleId != null && outranks(permissions.get(currentRoleId) ?? new Set(), mine)) {
    return 'RL007';
  }
  return null;
}
