'use server';

import { and, eq, inArray, isNull, or } from 'drizzle-orm';
import {
  role,
  rolePermission,
  permission,
  type Company,
  type Permission,
  type RolePermissionRow,
} from '@/db/schema';
import { db } from '@/lib/db';
import {
  handleCodedServerActionError,
  type ActionErrorType,
} from '@/lib/errors';
import {
  requireActionAuth,
  requireActionPermission,
} from '@/lib/security';
import { tenantOwnerRoleName } from '@/lib/company-bootstrap';
import { revalidatePath } from 'next/cache';
import { AuthorizationError } from '@/lib/errors';
import {
  actionAuthToGovernanceActor,
  fetchRolePermissionIds,
  recordGovernanceAudit,
  sanitizePermissionForAudit,
  sanitizeRoleForAudit,
} from '@/lib/governance-audit';

/** Matches `role.findMany({ with: { company, permissions.permission } })`. */
type RoleWithRelations = typeof role.$inferSelect & {
  company: Company | null;
  permissions: Array<RolePermissionRow & { permission: Permission | null }>;
};

const assertPermissionsAssignableToCompany = async (
  permissionIds: number[],
  companyId: number,
) => {
  const uniquePermissionIds = Array.from(new Set(permissionIds));
  if (uniquePermissionIds.length === 0) {
    return;
  }

  const rows = await db
    .select({ id: permission.id })
    .from(permission)
    .where(
      and(
        inArray(permission.id, uniquePermissionIds),
        isNull(permission.deleted_at),
        or(eq(permission.company_id, companyId), isNull(permission.company_id)),
      ),
    );

  if (rows.length !== uniquePermissionIds.length) {
    throw new AuthorizationError(
      'One or more permissions cannot be assigned to this role',
    );
  }
};

export async function getRoles(): Promise<{
  success: boolean;
  data?: RoleWithRelations[];
  error?: string;
  errorType?: ActionErrorType;
}> {
  try {
    const authContext = await requireActionAuth();
    await requireActionPermission('roles.read', authContext.companyId);
    const roles = await db.query.role.findMany({
      where: authContext.companyIsSystem
        ? isNull(role.deleted_at)
        : and(
            isNull(role.deleted_at),
            eq(role.company_id, authContext.companyId as number),
          ),
      with: {
        company: true,
        permissions: {
          with: {
            permission: true,
          },
        },
      },
    });
    const visibleRoles = roles.map((roleRow) => ({
      ...roleRow,
      company: roleRow.company?.deleted_at ? null : roleRow.company,
      permissions: roleRow.permissions
        .map((assignment) => ({
          ...assignment,
          permission: assignment.permission?.deleted_at
            ? null
            : assignment.permission,
        }))
        .filter((assignment) => assignment.permission !== null),
    }));

    return { success: true, data: visibleRoles as RoleWithRelations[] };
  } catch (error) {
    return handleCodedServerActionError('roles.list', 'RL001', error);
  }
}

export async function createRole(data: {
  name: string;
  description?: string;
  company_id: number;
  permissions: number[];
}): Promise<{
  success: boolean;
  data?: Awaited<ReturnType<typeof db.query.role.findFirst>>;
  error?: string;
  errorType?: ActionErrorType;
}> {
  try {
    // Company-scoped: tenant admins create roles inside their own company only.
    const { context: authContext, companyId: effectiveCompanyId } =
      await requireActionPermission('roles.write', data.company_id);
    await assertPermissionsAssignableToCompany(
      data.permissions,
      effectiveCompanyId,
    );

    let newRoleId = 0;
    await db.transaction(async (tx) => {
      const [newRole] = await tx
        .insert(role)
        .values({
          name: data.name,
          description: data.description,
          company_id: effectiveCompanyId,
        })
        .returning();

      newRoleId = newRole.id;

      if (data.permissions.length > 0) {
        await tx.insert(rolePermission).values(
          data.permissions.map((permissionId) => ({
            role_id: newRole.id,
            permission_id: permissionId,
          })),
        );
      }

      await recordGovernanceAudit(tx, {
        actor: actionAuthToGovernanceActor(authContext),
        resourceType: 'role',
        resourceId: newRole.id,
        targetCompanyId: effectiveCompanyId,
        eventType: 'created',
        after: sanitizeRoleForAudit(newRole, data.permissions),
      });
    });

    const full = await db.query.role.findFirst({
      where: eq(role.id, newRoleId),
      with: {
        company: true,
        permissions: {
          with: {
            permission: true,
          },
        },
      },
    });

    revalidatePath('/roles');
    return { success: true, data: full };
  } catch (error) {
    return handleCodedServerActionError('roles.create', 'RL002', error);
  }
}

export async function updateRole(
  id: number,
  data: {
    name: string;
    description?: string;
    company_id: number;
    permissions: number[];
  },
): Promise<{
  success: boolean;
  data?: Awaited<ReturnType<typeof db.query.role.findFirst>>;
  error?: string;
  errorType?: ActionErrorType;
}> {
  try {
    const { context: authContext, companyId: effectiveCompanyId } =
      await requireActionPermission('roles.write', data.company_id);
    await assertPermissionsAssignableToCompany(
      data.permissions,
      effectiveCompanyId,
    );

    const existingRole = await db.query.role.findFirst({
      where: and(eq(role.id, id), isNull(role.deleted_at)),
    });
    if (!existingRole) {
      throw new AuthorizationError('Role not found');
    }
    // Tenant admins may only edit roles in their own company.
    if (
      !authContext.companyIsSystem &&
      existingRole.company_id !== effectiveCompanyId
    ) {
      throw new AuthorizationError('Access denied to this role');
    }
    const beforePermissionIds = await fetchRolePermissionIds(id);

    await db.transaction(async (tx) => {
      await tx.delete(rolePermission).where(eq(rolePermission.role_id, id));

      const [updatedRole] = await tx
        .update(role)
        .set({
          name: data.name,
          description: data.description,
          company_id: effectiveCompanyId,
          updated_at: new Date(),
        })
        .where(and(eq(role.id, id), isNull(role.deleted_at)))
        .returning();

      if (data.permissions.length > 0) {
        await tx.insert(rolePermission).values(
          data.permissions.map((permissionId) => ({
            role_id: id,
            permission_id: permissionId,
          })),
        );
      }

      await recordGovernanceAudit(tx, {
        actor: actionAuthToGovernanceActor(authContext),
        resourceType: 'role',
        resourceId: id,
        targetCompanyId: effectiveCompanyId,
        eventType: 'updated',
        before: sanitizeRoleForAudit(existingRole, beforePermissionIds),
        after: sanitizeRoleForAudit(updatedRole, data.permissions),
      });
    });

    const full = await db.query.role.findFirst({
      where: eq(role.id, id),
      with: {
        company: true,
        permissions: {
          with: {
            permission: true,
          },
        },
      },
    });

    revalidatePath('/roles');
    return { success: true, data: full };
  } catch (error) {
    return handleCodedServerActionError('roles.update', 'RL003', error);
  }
}

export async function deleteRole(id: number): Promise<{
  success: boolean;
  error?: string;
  errorType?: ActionErrorType;
}> {
  try {
    const { context: authContext, companyId: effectiveCompanyId } =
      await requireActionPermission('roles.write');

    const existingRole = await db.query.role.findFirst({
      where: and(eq(role.id, id), isNull(role.deleted_at)),
    });
    if (!existingRole) {
      throw new AuthorizationError('Role not found');
    }
    // Tenant admins may only delete roles in their own company.
    if (
      !authContext.companyIsSystem &&
      existingRole.company_id !== effectiveCompanyId
    ) {
      throw new AuthorizationError('Access denied to this role');
    }
    // Protect the bootstrap tenant-admin role from removal to avoid lockout.
    if (existingRole.name === tenantOwnerRoleName(effectiveCompanyId)) {
      throw new AuthorizationError('Cannot delete the tenant administrator role');
    }
    const beforePermissionIds = await fetchRolePermissionIds(id);

    const [updatedRole] = await db
      .update(role)
      .set({ deleted_at: new Date(), updated_at: new Date() })
      .where(and(eq(role.id, id), isNull(role.deleted_at)))
      .returning();

    await recordGovernanceAudit(db, {
      actor: actionAuthToGovernanceActor(authContext),
      resourceType: 'role',
      resourceId: id,
      targetCompanyId: existingRole.company_id,
      eventType: 'deleted',
      before: sanitizeRoleForAudit(existingRole, beforePermissionIds),
      after: sanitizeRoleForAudit(updatedRole, beforePermissionIds),
    });

    revalidatePath('/roles');
    return { success: true };
  } catch (error) {
    return handleCodedServerActionError('roles.delete', 'RL004', error);
  }
}
