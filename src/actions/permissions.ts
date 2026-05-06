'use server';

import { and, asc, eq, isNull } from 'drizzle-orm';
import { permission, rolePermission } from '@/db/schema';
import { db } from '@/lib/db';
import { revalidatePath } from 'next/cache';

export async function getPermissions() {
  try {
    const permissions = await db.query.permission.findMany({
      where: isNull(permission.deleted_at),
      with: {
        company: true,
      },
    });
    return { permissions };
  } catch (error) {
    console.error('Error al obtener los permisos:', error);
    return { permissions: [] };
  }
}

export async function getPermissionsByCompany(companyId: number) {
  try {
    const permissions = await db
      .select()
      .from(permission)
      .where(
        and(eq(permission.company_id, companyId), isNull(permission.deleted_at)),
      )
      .orderBy(asc(permission.name));
    return { permissions };
  } catch (error) {
    console.error('Error al obtener permisos por empresa:', error);
    return { permissions: [] };
  }
}

export async function createPermission(data: {
  name: string;
  description?: string;
  company_id: number;
}) {
  try {
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
    revalidatePath('/dashboard/permissions');
    return { permission: created };
  } catch (error) {
    console.error('Error al crear permiso:', error);
    throw new Error('Error al crear permiso');
  }
}

export async function updatePermission(
  id: number,
  data: {
    name: string;
    description?: string;
    company_id: number;
  },
) {
  try {
    const [updated] = await db
      .update(permission)
      .set({
        name: data.name,
        description: data.description,
        company_id: data.company_id,
        updated_at: new Date(),
      })
      .where(eq(permission.id, id))
      .returning();
    revalidatePath('/dashboard/permissions');
    return { permission: updated };
  } catch (error) {
    console.error('Error al actualizar permiso:', error);
    throw new Error('Error al actualizar permiso');
  }
}

export async function deletePermission(id: number) {
  try {
    await db.delete(rolePermission).where(eq(rolePermission.permission_id, id));

    await db
      .update(permission)
      .set({ deleted_at: new Date() })
      .where(eq(permission.id, id));

    revalidatePath('/dashboard/permissions');
    return { success: true };
  } catch (error) {
    console.error('Error al eliminar permiso:', error);
    throw new Error('Error al eliminar permiso');
  }
}

export async function assignPermissionToRole(
  roleId: number,
  permissionId: number,
) {
  try {
    const [rolePermissionRow] = await db
      .insert(rolePermission)
      .values({
        role_id: roleId,
        permission_id: permissionId,
        created_at: new Date(),
      })
      .returning();

    revalidatePath('/dashboard/roles');
    return { rolePermission: rolePermissionRow };
  } catch (error) {
    console.error('Error al asignar el permiso al rol:', error);
    throw new Error('Error al asignar el permiso al rol');
  }
}

export async function removePermissionFromRole(
  roleId: number,
  permissionId: number,
) {
  try {
    await db
      .delete(rolePermission)
      .where(
        and(
          eq(rolePermission.role_id, roleId),
          eq(rolePermission.permission_id, permissionId),
        ),
      );

    revalidatePath('/dashboard/roles');
    return { rolePermission: null };
  } catch (error) {
    console.error('Error al remover el permiso del rol:', error);
    throw new Error('Error al remover el permiso del rol');
  }
}
