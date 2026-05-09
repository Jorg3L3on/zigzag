'use server';

import { eq } from 'drizzle-orm';
import { role, rolePermission } from '@/db/schema';
import { db } from '@/lib/db';
import { classifyServerErrorType, type ActionErrorType } from '@/lib/errors';
import { revalidatePath } from 'next/cache';

export async function getRoles(): Promise<{
  success: boolean;
  data?: Awaited<ReturnType<typeof db.query.role.findMany>>;
  error?: string;
  errorType?: ActionErrorType;
}> {
  try {
    const roles = await db.query.role.findMany({
      with: {
        company: true,
        permissions: {
          with: {
            permission: true,
          },
        },
      },
    });
    return { success: true, data: roles };
  } catch (error) {
    console.error('Error al obtener roles:', error);
    return {
      success: false,
      error: 'Error al obtener roles',
      errorType: classifyServerErrorType(error),
    };
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
    let newRoleId = 0;
    await db.transaction(async (tx) => {
      const [newRole] = await tx
        .insert(role)
        .values({
          name: data.name,
          description: data.description,
          company_id: data.company_id,
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

    revalidatePath('/dashboard/roles');
    return { success: true, data: full };
  } catch (error) {
    console.error('Error al crear rol:', error);
    return {
      success: false,
      error: 'Error al crear rol',
      errorType: classifyServerErrorType(error),
    };
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
    await db.transaction(async (tx) => {
      await tx.delete(rolePermission).where(eq(rolePermission.role_id, id));

      await tx
        .update(role)
        .set({
          name: data.name,
          description: data.description,
          company_id: data.company_id,
        })
        .where(eq(role.id, id));

      if (data.permissions.length > 0) {
        await tx.insert(rolePermission).values(
          data.permissions.map((permissionId) => ({
            role_id: id,
            permission_id: permissionId,
          })),
        );
      }
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

    revalidatePath('/dashboard/roles');
    return { success: true, data: full };
  } catch (error) {
    console.error('Error al actualizar rol:', error);
    return {
      success: false,
      error: 'Error al actualizar rol',
      errorType: classifyServerErrorType(error),
    };
  }
}

export async function deleteRole(id: number): Promise<{
  success: boolean;
  error?: string;
  errorType?: ActionErrorType;
}> {
  try {
    await db.transaction(async (tx) => {
      await tx.delete(rolePermission).where(eq(rolePermission.role_id, id));
      await tx.delete(role).where(eq(role.id, id));
    });

    revalidatePath('/dashboard/roles');
    return { success: true };
  } catch (error) {
    console.error('Error al eliminar rol:', error);
    return {
      success: false,
      error: 'Error al eliminar rol',
      errorType: classifyServerErrorType(error),
    };
  }
}
