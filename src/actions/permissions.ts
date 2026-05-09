'use server';

import { and, asc, eq, isNull } from 'drizzle-orm';
import { permission, rolePermission } from '@/db/schema';
import { db } from '@/lib/db';
import { classifyServerErrorType, type ActionErrorType } from '@/lib/errors';
import { revalidatePath } from 'next/cache';

export async function getPermissions(): Promise<{
  success: boolean;
  data?: (typeof permission.$inferSelect)[];
  error?: string;
  errorType?: ActionErrorType;
}> {
  try {
    const permissions = await db.query.permission.findMany({
      where: isNull(permission.deleted_at),
      with: {
        company: true,
      },
    });
    return { success: true, data: permissions };
  } catch (error) {
    console.error('Error al obtener los permisos:', error);
    return {
      success: false,
      error: 'Error al obtener los permisos',
      errorType: classifyServerErrorType(error),
    };
  }
}

export async function getPermissionsByCompany(companyId: number): Promise<{
  success: boolean;
  data?: (typeof permission.$inferSelect)[];
  error?: string;
  errorType?: ActionErrorType;
}> {
  try {
    const permissions = await db
      .select()
      .from(permission)
      .where(
        and(eq(permission.company_id, companyId), isNull(permission.deleted_at)),
      )
      .orderBy(asc(permission.name));
    return { success: true, data: permissions };
  } catch (error) {
    console.error('Error al obtener permisos por empresa:', error);
    return {
      success: false,
      error: 'Error al obtener permisos por empresa',
      errorType: classifyServerErrorType(error),
    };
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
    return { success: true, data: created };
  } catch (error) {
    console.error('Error al crear permiso:', error);
    return {
      success: false,
      error: 'Error al crear permiso',
      errorType: classifyServerErrorType(error),
    };
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
    return { success: true, data: updated };
  } catch (error) {
    console.error('Error al actualizar permiso:', error);
    return {
      success: false,
      error: 'Error al actualizar permiso',
      errorType: classifyServerErrorType(error),
    };
  }
}

export async function deletePermission(id: number): Promise<{
  success: boolean;
  error?: string;
  errorType?: ActionErrorType;
}> {
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
    return {
      success: false,
      error: 'Error al eliminar permiso',
      errorType: classifyServerErrorType(error),
    };
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
    const [rolePermissionRow] = await db
      .insert(rolePermission)
      .values({
        role_id: roleId,
        permission_id: permissionId,
        created_at: new Date(),
      })
      .returning();

    revalidatePath('/dashboard/roles');
    return { success: true, data: rolePermissionRow };
  } catch (error) {
    console.error('Error al asignar el permiso al rol:', error);
    return {
      success: false,
      error: 'Error al asignar el permiso al rol',
      errorType: classifyServerErrorType(error),
    };
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
    await db
      .delete(rolePermission)
      .where(
        and(
          eq(rolePermission.role_id, roleId),
          eq(rolePermission.permission_id, permissionId),
        ),
      );

    revalidatePath('/dashboard/roles');
    return { success: true, data: null };
  } catch (error) {
    console.error('Error al remover el permiso del rol:', error);
    return {
      success: false,
      error: 'Error al remover el permiso del rol',
      errorType: classifyServerErrorType(error),
    };
  }
}
