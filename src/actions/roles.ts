'use server';

import { db } from '@/lib/db';
import { revalidatePath } from 'next/cache';

export async function getRoles() {
  try {
    const roles = await db.role.findMany({
      include: {
        company: true,
        permissions: {
          include: {
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
    const role = await db.role.create({
      data: {
        name: data.name,
        description: data.description,
        company_id: data.company_id,
        permissions: {
          create: data.permissions.map((permissionId) => ({
            permission_id: permissionId,
          })),
        },
      },
      include: {
        company: true,
        permissions: {
          include: {
            permission: true,
          },
        },
      },
    });
    revalidatePath('/dashboard/roles');
    return { role };
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
    // First, delete all existing permissions
    await db.rolePermission.deleteMany({
      where: {
        role_id: id,
      },
    });

    // Then update the role and create new permissions
    const role = await db.role.update({
      where: { id },
      data: {
        name: data.name,
        description: data.description,
        company_id: data.company_id,
        permissions: {
          create: data.permissions.map((permissionId) => ({
            permission_id: permissionId,
          })),
        },
      },
      include: {
        company: true,
        permissions: {
          include: {
            permission: true,
          },
        },
      },
    });
    revalidatePath('/dashboard/roles');
    return { role };
  } catch (error) {
    console.error('Error al actualizar rol:', error);
    throw new Error('Error al actualizar rol');
  }
}

export async function deleteRole(id: number) {
  try {
    // First delete all permissions
    await db.rolePermission.deleteMany({
      where: {
        role_id: id,
      },
    });

    // Then delete the role
    await db.role.delete({
      where: { id },
    });
    revalidatePath('/dashboard/roles');
    return { success: true };
  } catch (error) {
    console.error('Error al eliminar rol:', error);
    throw new Error('Error al eliminar rol');
  }
}
