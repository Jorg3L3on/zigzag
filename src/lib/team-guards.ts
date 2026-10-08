import { and, count, eq, inArray, isNull, ne, or } from 'drizzle-orm';
import {
  company,
  permission,
  role,
  rolePermission,
  user,
} from '@/db/schema';
import { db } from '@/lib/db';
import { PERMISSIONS } from '@/lib/permissions';

/** The permission that makes someone a team manager (can add, edit and deactivate users). */
export const TEAM_MANAGER_PERMISSION = PERMISSIONS.users.write;

const permissionIdsFor = async (companyId: number, permissionName: string) => {
  const rows = await db
    .select({ id: permission.id })
    .from(permission)
    .where(
      and(
        eq(permission.name, permissionName),
        isNull(permission.deleted_at),
        or(eq(permission.company_id, companyId), isNull(permission.company_id)),
      ),
    );
  return rows.map((row) => row.id);
};

/** Same resolution as `checkUserPermission`: active role of this company (or global) holding the key. */
export async function roleGrantsPermission(
  roleId: number | null,
  companyId: number,
  permissionName: string,
): Promise<boolean> {
  if (roleId === null) {
    return false;
  }

  const roleRow = await db.query.role.findFirst({
    where: and(eq(role.id, roleId), isNull(role.deleted_at)),
  });
  if (!roleRow || (roleRow.company_id !== null && roleRow.company_id !== companyId)) {
    return false;
  }

  const permissionIds = await permissionIdsFor(companyId, permissionName);
  if (permissionIds.length === 0) {
    return false;
  }

  const granted = await db
    .select({ role_id: rolePermission.role_id })
    .from(rolePermission)
    .where(
      and(
        eq(rolePermission.role_id, roleId),
        inArray(rolePermission.permission_id, permissionIds),
      ),
    )
    .limit(1);

  return granted.length > 0;
}

/** Active users of the company, other than `excludeUserId`, whose role grants the permission. */
export async function countOtherUsersWithPermission(
  companyId: number,
  permissionName: string,
  excludeUserId: bigint,
): Promise<number> {
  const permissionIds = await permissionIdsFor(companyId, permissionName);
  if (permissionIds.length === 0) {
    return 0;
  }

  const [row] = await db
    .select({ value: count() })
    .from(user)
    .innerJoin(role, eq(role.id, user.role_id))
    .innerJoin(rolePermission, eq(rolePermission.role_id, role.id))
    .where(
      and(
        eq(user.company_id, companyId),
        isNull(user.deleted_at),
        ne(user.id, excludeUserId),
        isNull(role.deleted_at),
        or(eq(role.company_id, companyId), isNull(role.company_id)),
        inArray(rolePermission.permission_id, permissionIds),
      ),
    );

  return Number(row?.value ?? 0);
}

async function isSystemCompany(companyId: number): Promise<boolean> {
  const row = await db.query.company.findFirst({
    where: eq(company.id, companyId),
    columns: { is_system: true },
  });
  return Boolean(row?.is_system);
}

export type TeamManagerChange = {
  companyId: number | null;
  targetUserId: bigint;
  currentRoleId: number | null;
  /** Role after the change; `null` when the user is being deactivated. */
  nextRoleId: number | null;
};

export type TeamGuardDeps = {
  roleGrantsPermission: typeof roleGrantsPermission;
  countOtherUsersWithPermission: typeof countOtherUsersWithPermission;
  isSystemCompany: typeof isSystemCompany;
};

const defaultDeps: TeamGuardDeps = {
  roleGrantsPermission,
  countOtherUsersWithPermission,
  isSystemCompany,
};

/**
 * False when the change would leave a tenant company with nobody able to
 * manage its team (last holder of `users.write` demoted or deactivated).
 * System companies grant every permission to their users, so they never lock out.
 */
export async function keepsATeamManager(
  change: TeamManagerChange,
  deps: TeamGuardDeps = defaultDeps,
): Promise<boolean> {
  const { companyId, targetUserId, currentRoleId, nextRoleId } = change;
  if (companyId === null || currentRoleId === nextRoleId) {
    return true;
  }

  const isManagerNow = await deps.roleGrantsPermission(
    currentRoleId,
    companyId,
    TEAM_MANAGER_PERMISSION,
  );
  if (!isManagerNow) {
    return true;
  }

  const staysManager = await deps.roleGrantsPermission(
    nextRoleId,
    companyId,
    TEAM_MANAGER_PERMISSION,
  );
  if (staysManager) {
    return true;
  }

  if (await deps.isSystemCompany(companyId)) {
    return true;
  }

  const others = await deps.countOtherUsersWithPermission(
    companyId,
    TEAM_MANAGER_PERMISSION,
    targetUserId,
  );
  return others > 0;
}
