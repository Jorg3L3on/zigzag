'use server';

import { permission, role, rolePermission, user } from '@/db/schema';
import { db } from '@/lib/db';
import { requireActionAuth } from '@/lib/security';
import { and, eq, inArray, isNull, or } from 'drizzle-orm';

export type SessionPermissionMap = {
  isSystem: boolean;
  permissions: string[];
};

export async function getSessionPermissionMap(): Promise<SessionPermissionMap> {
  const context = await requireActionAuth();

  if (context.companyIsSystem) {
    return { isSystem: true, permissions: [] };
  }

  if (!context.companyId) {
    return { isSystem: false, permissions: [] };
  }

  const userRow = await db.query.user.findFirst({
    where: and(eq(user.id, BigInt(context.userId)), isNull(user.deleted_at)),
  });

  if (!userRow?.role_id) {
    return { isSystem: false, permissions: [] };
  }

  const roleRow = await db.query.role.findFirst({
    where: and(eq(role.id, userRow.role_id), isNull(role.deleted_at)),
  });

  if (!roleRow) {
    return { isSystem: false, permissions: [] };
  }

  const assigned = await db
    .select({ permissionId: rolePermission.permission_id })
    .from(rolePermission)
    .where(eq(rolePermission.role_id, userRow.role_id));

  if (assigned.length === 0) {
    return { isSystem: false, permissions: [] };
  }

  const rows = await db
    .select({ name: permission.name })
    .from(permission)
    .where(
      and(
        inArray(
          permission.id,
          assigned.map((row) => row.permissionId),
        ),
        isNull(permission.deleted_at),
        or(
          eq(permission.company_id, context.companyId),
          isNull(permission.company_id),
        ),
      ),
    );

  return {
    isSystem: false,
    permissions: rows.map((row) => row.name),
  };
}
