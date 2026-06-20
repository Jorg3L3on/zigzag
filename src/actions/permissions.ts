'use server';

import { and, asc, eq, isNull, or } from 'drizzle-orm';
import { permission, role, rolePermission, type Company } from '@/db/schema';
import { db } from '@/lib/db';
import {
  AuthorizationError,
  handleCodedServerActionError,
  type ActionErrorType,
} from '@/lib/errors';
import {
  requireActionAuth,
  requireActionPermission,
  requireSystemUser,
} from '@/lib/security';
import { revalidatePath } from 'next/cache';
import {
  actionAuthToGovernanceActor,
  recordGovernanceAudit,
  sanitizePermissionForAudit,
} from '@/lib/governance-audit';

type PermissionWithCompany = typeof permission.$inferSelect & {
  company: Company | null;
};

const assertRolePermissionSameScope = async (
  roleId: number,
  permissionId: number,
) => {
  const [roleRow, permissionRow] = await Promise.all([
    db.query.role.findFirst({
      where: and(eq(role.id, roleId), isNull(role.deleted_at)),
    }),
    db.query.permission.findFirst({
      where: and(eq(permission.id, permissionId), isNull(permission.deleted_at)),
    }),
  ]);

  if (!roleRow || !permissionRow) {
    throw new AuthorizationError('Role or permission not found');
  }

  if (
    permissionRow.company_id !== null &&
    permissionRow.company_id !== roleRow.company_id
  ) {
    throw new AuthorizationError(
      'Permission cannot be assigned to a role from another company',
    );
  }
};

export async function getPermissions(): Promise<{
  success: boolean;
  data?: PermissionWithCompany[];
  error?: string;
  errorType?: ActionErrorType;
}> {
  try {
    const authContext = await requireActionAuth();
    await requireActionPermission('permissions.read', authContext.companyId);
    const permissions = await db.query.permission.findMany({
      where: authContext.companyIsSystem
        ? isNull(permission.deleted_at)
        : and(
            isNull(permission.deleted_at),
            or(
              eq(permission.company_id, authContext.companyId as number),
              isNull(permission.company_id),
            ),
          ),
      with: {
        company: true,
      },
    });
    return { success: true, data: permissions };
  } catch (error) {
    return handleCodedServerActionError('permissions.list', 'PM001', error);
  }
}

export async function getPermissionsByCompany(companyId: number): Promise<{
  success: boolean;
  data?: (typeof permission.$inferSelect)[];
  error?: string;
  errorType?: ActionErrorType;
}> {
  try {
    await requireActionPermission('permissions.read', companyId);
    const permissions = await db
      .select()
      .from(permission)
      .where(
        and(eq(permission.company_id, companyId), isNull(permission.deleted_at)),
      )
      .orderBy(asc(permission.name));
    return { success: true, data: permissions };
  } catch (error) {
    return handleCodedServerActionError('permissions.list-by-company', 'PM001', error);
  }
}

export async function createPermission(data: {
  name: string;
  description?: string;
  company_id: number;
}): Promise<{
  success: boolean;
  data?: typeof permission.$inferSelect;
  error?: string;
  errorType?: ActionErrorType;
}> {
  try {
    await requireActionPermission('permissions.write', data.company_id);
    const authContext = await requireActionAuth();
    requireSystemUser(authContext);

    const [created] = await db
      .insert(permission)
      .values({
        name: data.name,
        description: data.description,
        company_id: data.company_id,
        created_at: new Date(),
        updated_at: new Date(),
      })
      .returning();

    await recordGovernanceAudit(db, {
      actor: actionAuthToGovernanceActor(authContext),
      resourceType: 'permission',
      resourceId: created.id,
      targetCompanyId: data.company_id,
      eventType: 'created',
      after: sanitizePermissionForAudit(created),
    });

    revalidatePath('/permissions');
    return { success: true, data: created };
  } catch (error) {
    return handleCodedServerActionError('permissions.create', 'PM002', error);
  }
}

export async function updatePermission(
  id: number,
  data: {
    name: string;
    description?: string;
    company_id: number;
  },
): Promise<{
  success: boolean;
  data?: typeof permission.$inferSelect;
  error?: string;
  errorType?: ActionErrorType;
}> {
  try {
    await requireActionPermission('permissions.write', data.company_id);
    const authContext = await requireActionAuth();
    requireSystemUser(authContext);

    const existing = await db.query.permission.findFirst({
      where: and(
        eq(permission.id, id),
        eq(permission.company_id, data.company_id),
        isNull(permission.deleted_at),
      ),
    });
    if (!existing) {
      throw new AuthorizationError('Permission not found');
    }

    const [updated] = await db
      .update(permission)
      .set({
        name: data.name,
        description: data.description,
        company_id: data.company_id,
        updated_at: new Date(),
      })
      .where(
        and(
          eq(permission.id, id),
          eq(permission.company_id, data.company_id),
          isNull(permission.deleted_at),
        ),
      )
      .returning();

    await recordGovernanceAudit(db, {
      actor: actionAuthToGovernanceActor(authContext),
      resourceType: 'permission',
      resourceId: id,
      targetCompanyId: data.company_id,
      eventType: 'updated',
      before: sanitizePermissionForAudit(existing),
      after: sanitizePermissionForAudit(updated),
    });

    revalidatePath('/permissions');
    return { success: true, data: updated };
  } catch (error) {
    return handleCodedServerActionError('permissions.update', 'PM003', error);
  }
}

export async function deletePermission(id: number): Promise<{
  success: boolean;
  error?: string;
  errorType?: ActionErrorType;
}> {
  try {
    await requireActionPermission('permissions.write');
    const authContext = await requireActionAuth();
    requireSystemUser(authContext);

    const existing = await db.query.permission.findFirst({
      where: and(eq(permission.id, id), isNull(permission.deleted_at)),
    });
    if (!existing) {
      throw new AuthorizationError('Permission not found');
    }

    await db.delete(rolePermission).where(eq(rolePermission.permission_id, id));

    const [updated] = await db
      .update(permission)
      .set({ deleted_at: new Date() })
      .where(and(eq(permission.id, id), isNull(permission.deleted_at)))
      .returning();

    await recordGovernanceAudit(db, {
      actor: actionAuthToGovernanceActor(authContext),
      resourceType: 'permission',
      resourceId: id,
      targetCompanyId: existing.company_id,
      eventType: 'deleted',
      before: sanitizePermissionForAudit(existing),
      after: sanitizePermissionForAudit(updated),
    });

    revalidatePath('/permissions');
    return { success: true };
  } catch (error) {
    return handleCodedServerActionError('permissions.delete', 'PM004', error);
  }
}

export async function assignPermissionToRole(
  roleId: number,
  permissionId: number,
): Promise<{
  success: boolean;
  data?: typeof rolePermission.$inferSelect;
  error?: string;
  errorType?: ActionErrorType;
}> {
  try {
    await requireActionPermission('permissions.write');
    const authContext = await requireActionAuth();
    requireSystemUser(authContext);
    await assertRolePermissionSameScope(roleId, permissionId);

    const [roleRow, permissionRow] = await Promise.all([
      db.query.role.findFirst({
        where: and(eq(role.id, roleId), isNull(role.deleted_at)),
      }),
      db.query.permission.findFirst({
        where: and(eq(permission.id, permissionId), isNull(permission.deleted_at)),
      }),
    ]);

    const [rolePermissionRow] = await db
      .insert(rolePermission)
      .values({
        role_id: roleId,
        permission_id: permissionId,
        created_at: new Date(),
      })
      .returning();

    await recordGovernanceAudit(db, {
      actor: actionAuthToGovernanceActor(authContext),
      resourceType: 'role',
      resourceId: roleId,
      targetCompanyId: roleRow?.company_id ?? null,
      eventType: 'permission_assigned',
      before: { permission_id: permissionId, assigned: false },
      after: {
        permission_id: permissionId,
        permission: sanitizePermissionForAudit(permissionRow),
        assigned: true,
      },
    });

    revalidatePath('/roles');
    return { success: true, data: rolePermissionRow };
  } catch (error) {
    return handleCodedServerActionError('permissions.assign-to-role', 'PM005', error);
  }
}

export async function removePermissionFromRole(
  roleId: number,
  permissionId: number,
): Promise<{
  success: boolean;
  data?: null;
  error?: string;
  errorType?: ActionErrorType;
}> {
  try {
    await requireActionPermission('permissions.write');
    const authContext = await requireActionAuth();
    requireSystemUser(authContext);

    const [roleRow, permissionRow] = await Promise.all([
      db.query.role.findFirst({
        where: and(eq(role.id, roleId), isNull(role.deleted_at)),
      }),
      db.query.permission.findFirst({
        where: and(eq(permission.id, permissionId), isNull(permission.deleted_at)),
      }),
    ]);

    await db
      .delete(rolePermission)
      .where(
        and(
          eq(rolePermission.role_id, roleId),
          eq(rolePermission.permission_id, permissionId),
        ),
      );

    await recordGovernanceAudit(db, {
      actor: actionAuthToGovernanceActor(authContext),
      resourceType: 'role',
      resourceId: roleId,
      targetCompanyId: roleRow?.company_id ?? null,
      eventType: 'permission_removed',
      before: {
        permission_id: permissionId,
        permission: sanitizePermissionForAudit(permissionRow),
        assigned: true,
      },
      after: { permission_id: permissionId, assigned: false },
    });

    revalidatePath('/roles');
    return { success: true, data: null };
  } catch (error) {
    return handleCodedServerActionError('permissions.remove-from-role', 'PM006', error);
  }
}
