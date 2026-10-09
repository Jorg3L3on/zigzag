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

/** Permissions a tenant must never lose entirely: managing the team and managing roles. */
export const LOCKOUT_PERMISSIONS = [
  PERMISSIONS.users.write,
  PERMISSIONS.roles.write,
] as const;

export async function countActiveUsersWithRole(roleId: number): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(user)
    .where(and(eq(user.role_id, roleId), isNull(user.deleted_at)));
  return Number(row?.value ?? 0);
}

/** Active users of the company whose role (other than `roleId`) grants the permission. */
export async function countUsersWithPermissionOutsideRole(
  companyId: number,
  permissionName: string,
  roleId: number,
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
        ne(user.role_id, roleId),
        isNull(role.deleted_at),
        or(eq(role.company_id, companyId), isNull(role.company_id)),
        inArray(rolePermission.permission_id, permissionIds),
      ),
    );

  return Number(row?.value ?? 0);
}

async function permissionNamesForIds(ids: number[]): Promise<Set<string>> {
  if (ids.length === 0) {
    return new Set();
  }
  const rows = await db
    .select({ name: permission.name })
    .from(permission)
    .where(and(inArray(permission.id, ids), isNull(permission.deleted_at)));
  return new Set(rows.map((row) => row.name));
}

export type RolePermissionChange = {
  /** The role's own company; global roles (null) are skipped. */
  companyId: number | null;
  roleId: number;
  beforePermissionIds: number[];
  afterPermissionIds: number[];
};

export type RoleGuardDeps = {
  permissionNamesForIds: typeof permissionNamesForIds;
  countActiveUsersWithRole: typeof countActiveUsersWithRole;
  countUsersWithPermissionOutsideRole: typeof countUsersWithPermissionOutsideRole;
  isSystemCompany: typeof isSystemCompany;
};

const defaultRoleDeps: RoleGuardDeps = {
  permissionNamesForIds,
  countActiveUsersWithRole,
  countUsersWithPermissionOutsideRole,
  isSystemCompany,
};

/**
 * False when editing the role would leave its tenant with nobody holding
 * users.write or roles.write (the role's holders were the last ones).
 */
export async function roleChangeKeepsAdmins(
  change: RolePermissionChange,
  deps: RoleGuardDeps = defaultRoleDeps,
): Promise<boolean> {
  const { companyId, roleId } = change;
  if (companyId === null) {
    return true;
  }

  const [before, after] = await Promise.all([
    deps.permissionNamesForIds(change.beforePermissionIds),
    deps.permissionNamesForIds(change.afterPermissionIds),
  ]);
  const dropped = LOCKOUT_PERMISSIONS.filter(
    (name) => before.has(name) && !after.has(name),
  );
  if (dropped.length === 0) {
    return true;
  }

  if ((await deps.countActiveUsersWithRole(roleId)) === 0) {
    return true;
  }
  if (await deps.isSystemCompany(companyId)) {
    return true;
  }

  for (const name of dropped) {
    if ((await deps.countUsersWithPermissionOutsideRole(companyId, name, roleId)) === 0) {
      return false;
    }
  }
  return true;
}
