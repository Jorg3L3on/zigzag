'use server';

import { eq } from 'drizzle-orm';
import { role, rolePermission } from '@/db/schema';
import { db } from '@/lib/db';
import { revalidatePath } from 'next/cache';

export async function getRoles() {
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
    return { roles };
  } catch (error) {
    console.error('Error al obtener roles:', error);
    return { roles: [] };
  }
}

export async function createRole(data: {
  name: string;
  description?: string;
  company_id: number;
  permissions: number[];
}) {
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
    return { role: full };
  } catch (error) {
    console.error('Error al crear rol:', error);
    throw new Error('Error al crear rol');
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
) {
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
    return { role: full };
  } catch (error) {
    console.error('Error al actualizar rol:', error);
    throw new Error('Error al actualizar rol');
  }
}

export async function deleteRole(id: number) {
  try {
    await db.transaction(async (tx) => {
      await tx.delete(rolePermission).where(eq(rolePermission.role_id, id));
      await tx.delete(role).where(eq(role.id, id));
    });

    revalidatePath('/dashboard/roles');
    return { success: true };
  } catch (error) {
    console.error('Error al eliminar rol:', error);
    throw new Error('Error al eliminar rol');
  }
}
