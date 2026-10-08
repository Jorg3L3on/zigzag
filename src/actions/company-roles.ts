'use server';

import { and, count, eq, inArray, isNull, or } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { permission, role, rolePermission, user } from '@/db/schema';
import { createRole, deleteRole, updateRole } from '@/actions/roles';
import { isProtectedBootstrapAdminRole } from '@/lib/company-bootstrap';
import { db } from '@/lib/db';
import {
  buildActionError,
  handleCodedServerActionError,
  type ActionErrorType,
} from '@/lib/errors';
import { PERMISSIONS } from '@/lib/permissions';
import {
  actionAuthToGovernanceActor,
  recordGovernanceAudit,
  sanitizeRoleForAudit,
} from '@/lib/governance-audit';
import { ROLE_MATRIX_KEYS } from '@/lib/role-matrix';
import { checkPermission, requireActionPermission } from '@/lib/security';
import {
  countUsersWithPermissionOutsideRole,
  LOCKOUT_PERMISSIONS,
} from '@/lib/team-guards';
import type { ActionAuthContext } from '@/lib/authz-context';

type ActionResult<T = undefined> = {
  success: boolean;
  data?: T;
  error?: string;
  errorCode?: string;
  errorType?: ActionErrorType;
};

export type CompanyRoleSummary = {
  id: number;
  name: string;
  description: string | null;
  /** Shared platform role (company_id null): saving it creates a company copy. */
  isGlobal: boolean;
  /** Bootstrap Admin role: cannot be deleted. */
  isProtected: boolean;
  userCount: number;
  permissionKeys: string[];
};

export type CompanyRolesData = {
  roles: CompanyRoleSummary[];
  canWrite: boolean;
};

const roleInputSchema = z.object({
  name: z.string().trim().min(1, 'El nombre es requerido').max(60),
  description: z.string().trim().max(200).optional(),
  permissionKeys: z.array(z.string()),
});

const toResult = (result: {
  success: boolean;
  error?: string;
  errorCode?: string;
  errorType?: ActionErrorType;
}): ActionResult<never> =>
  result.success
    ? { success: true }
    : {
        success: false,
        error: result.error,
        errorCode: result.errorCode,
        errorType: result.errorType,
      };

/**
 * Roles tab (ZIG-I3-5): the caller company's roles plus the shared global
 * ones, with how many active members hold each. Never takes a company id.
 */
export async function getCompanyRoles(): Promise<ActionResult<CompanyRolesData>> {
  try {
    const { context, companyId } = await requireActionPermission(
      PERMISSIONS.roles.read,
    );

    const [roleRows, counts, canWrite] = await Promise.all([
      db.query.role.findMany({
        where: and(
          isNull(role.deleted_at),
          or(eq(role.company_id, companyId), isNull(role.company_id)),
        ),
        with: { permissions: { with: { permission: true } } },
      }),
      db
        .select({ roleId: user.role_id, value: count() })
        .from(user)
        .where(and(eq(user.company_id, companyId), isNull(user.deleted_at)))
        .groupBy(user.role_id),
      checkPermission(context.userId, companyId, PERMISSIONS.roles.write),
    ]);

    const countByRole = new Map(
      counts.map((row) => [row.roleId, Number(row.value)] as const),
    );

    const roles = roleRows
      .map((row) => ({
        id: row.id,
        name: row.name,
        description: row.description,
        isGlobal: row.company_id === null,
        isProtected: isProtectedBootstrapAdminRole(row.name, row.company_id, companyId),
        userCount: countByRole.get(row.id) ?? 0,
        permissionKeys: row.permissions
          .map((assignment) => assignment.permission)
          .filter((item) => item && !item.deleted_at)
          .map((item) => item!.name)
          .sort(),
      }))
      // Own roles first, then shared ones; alphabetical inside each group.
      .sort(
        (a, b) =>
          Number(a.isGlobal) - Number(b.isGlobal) || a.name.localeCompare(b.name, 'es'),
      );

    return { success: true, data: { roles, canWrite } };
  } catch (e) {
    return handleCodedServerActionError('companyRoles.list', 'RL001', e);
  }
}

/** Global catalog row per key (company rows as fallback), scoped to the caller. */
async function resolvePermissionIds(
  keys: string[],
  companyId: number,
): Promise<number[] | null> {
  if (keys.length === 0) {
    return [];
  }
  const rows = await db
    .select({
      id: permission.id,
      name: permission.name,
      companyId: permission.company_id,
    })
    .from(permission)
    .where(
      and(
        inArray(permission.name, keys),
        isNull(permission.deleted_at),
        or(eq(permission.company_id, companyId), isNull(permission.company_id)),
      ),
    );

  const idByName = new Map<string, number>();
  for (const row of rows) {
    if (!idByName.has(row.name) || row.companyId === null) {
      idByName.set(row.name, row.id);
    }
  }
  if (keys.some((key) => !idByName.has(key))) {
    return null;
  }
  return keys.map((key) => idByName.get(key)!);
}

/**
 * Copy-on-write for a shared global role (ZIG-I3 decision): create a copy owned
 * by the caller's company with the edited values and move this company's active
 * users onto it, in one transaction. The global role and other tenants are untouched.
 */
async function forkGlobalRole(input: {
  context: ActionAuthContext;
  companyId: number;
  globalRoleId: number;
  name: string;
  description?: string;
  permissionIds: number[];
  permissionKeys: string[];
}): Promise<ActionResult<{ id: number }>> {
  const { context, companyId, globalRoleId } = input;

  const [holders] = await db
    .select({ value: count() })
    .from(user)
    .where(
      and(
        eq(user.company_id, companyId),
        eq(user.role_id, globalRoleId),
        isNull(user.deleted_at),
      ),
    );
  const movingUsers = Number(holders?.value ?? 0);

  // Same lockout rule as updateRole: the people moving onto the copy may be
  // the company's last team or role managers.
  if (movingUsers > 0) {
    for (const name of LOCKOUT_PERMISSIONS) {
      if (input.permissionKeys.includes(name)) {
        continue;
      }
      const others = await countUsersWithPermissionOutsideRole(
        companyId,
        name,
        globalRoleId,
      );
      if (others === 0) {
        return buildActionError('RL006');
      }
    }
  }

  const newRoleId = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(role)
      .values({
        name: input.name,
        description: input.description,
        company_id: companyId,
      })
      .returning();

    if (input.permissionIds.length > 0) {
      await tx.insert(rolePermission).values(
        input.permissionIds.map((permissionId) => ({
          role_id: created.id,
          permission_id: permissionId,
        })),
      );
    }

    await tx
      .update(user)
      .set({ role_id: created.id, updated_at: new Date() })
      .where(
        and(
          eq(user.company_id, companyId),
          eq(user.role_id, globalRoleId),
          isNull(user.deleted_at),
        ),
      );

    await recordGovernanceAudit(tx, {
      actor: actionAuthToGovernanceActor(context),
      resourceType: 'role',
      resourceId: created.id,
      targetCompanyId: companyId,
      eventType: 'created',
      after: sanitizeRoleForAudit(created, input.permissionIds),
      extra: { forkedFromRoleId: globalRoleId, movedUsers: movingUsers },
    });

    return created.id;
  });

  revalidatePath('/roles');
  revalidatePath('/company', 'layout');
  return { success: true, data: { id: newRoleId } };
}

export async function saveCompanyRole(input: {
  id?: number;
  name: string;
  description?: string;
  permissionKeys: string[];
}): Promise<ActionResult<{ id: number }>> {
  const failCode = input.id ? 'RL003' : 'RL002';
  try {
    const { context, companyId } = await requireActionPermission(
      PERMISSIONS.roles.write,
    );
    const parsed = roleInputSchema.parse(input);

    let currentKeys: string[] = [];
    let forkFromGlobal = false;
    if (input.id) {
      const existing = await db.query.role.findFirst({
        where: and(eq(role.id, input.id), isNull(role.deleted_at)),
        with: { permissions: { with: { permission: true } } },
      });
      // Own roles are edited in place; shared global ones are copied on write.
      // Another company's role is never reachable.
      if (!existing || (existing.company_id !== null && existing.company_id !== companyId)) {
        return buildActionError('RL003');
      }
      forkFromGlobal = existing.company_id === null;
      currentKeys = existing.permissions
        .map((assignment) => assignment.permission?.name)
        .filter((name): name is string => Boolean(name));
    }

    // The matrix keys, plus whatever the role already had (kept untouched).
    const allowed = new Set([...ROLE_MATRIX_KEYS, ...currentKeys]);
    const keys = Array.from(new Set(parsed.permissionKeys));
    if (keys.some((key) => !allowed.has(key))) {
      return buildActionError(failCode);
    }

    const permissionIds = await resolvePermissionIds(keys, companyId);
    if (permissionIds === null) {
      return buildActionError(failCode);
    }

    if (forkFromGlobal && input.id) {
      return await forkGlobalRole({
        context,
        companyId,
        globalRoleId: input.id,
        name: parsed.name,
        description: parsed.description || undefined,
        permissionIds,
        permissionKeys: keys,
      });
    }

    const payload = {
      name: parsed.name,
      description: parsed.description || undefined,
      company_id: companyId,
      permissions: permissionIds,
    };
    const result = input.id
      ? await updateRole(input.id, payload)
      : await createRole(payload);

    if (!result.success) {
      return toResult(result);
    }
    return { success: true, data: { id: result.data?.id ?? input.id ?? 0 } };
  } catch (e) {
    if (e instanceof z.ZodError) {
      return buildActionError(failCode);
    }
    return handleCodedServerActionError('companyRoles.save', failCode, e);
  }
}

export async function deleteCompanyRole(id: number): Promise<ActionResult> {
  try {
    const { companyId } = await requireActionPermission(PERMISSIONS.roles.write);
    const existing = await db.query.role.findFirst({
      where: and(eq(role.id, id), isNull(role.deleted_at)),
    });
    if (!existing || existing.company_id !== companyId) {
      return buildActionError('RL004');
    }
    return toResult(await deleteRole(id, companyId));
  } catch (e) {
    return handleCodedServerActionError('companyRoles.delete', 'RL004', e);
  }
}
