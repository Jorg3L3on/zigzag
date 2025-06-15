'use server';

import { db } from '@/lib/db';
import { revalidatePath } from 'next/cache';

export async function getPermissions() {
  try {
    const permissions = await db.permission.findMany({
      where: {
        deleted_at: null,
      },
      include: {
        company: true,
      },
      orderBy: {
        created_at: 'desc',
      },
    });

    return { permissions };
  } catch (error) {
    console.error('Error al obtener los permisos:', error);
    return { permissions: [] };
  }
}

export async function createPermission(data: {
  name: string;
  description?: string;
  company_id: number;
}) {
  try {
    const permission = await db.permission.create({
      data: {
        name: data.name,
        description: data.description,
        company_id: data.company_id,
        created_at: new Date(),
        updated_at: new Date(),
      },
    });

    revalidatePath('/dashboard/permissions');
    return { permission };
  } catch (error) {
    console.error('Error al crear el permiso:', error);
    throw new Error('Error al crear el permiso');
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
    const permission = await db.permission.update({
      where: { id },
      data: {
        name: data.name,
        description: data.description,
        company_id: data.company_id,
        updated_at: new Date(),
      },
    });

    revalidatePath('/dashboard/permissions');
    return { permission };
  } catch (error) {
    console.error('Error al actualizar el permiso:', error);
    throw new Error('Error al actualizar el permiso');
  }
}

export async function deletePermission(id: number) {
  try {
    const permission = await db.permission.update({
      where: { id },
      data: {
        deleted_at: new Date(),
        updated_at: new Date(),
      },
    });

    revalidatePath('/dashboard/permissions');
    return { permission };
  } catch (error) {
    console.error('Error al eliminar el permiso:', error);
    throw new Error('Error al eliminar el permiso');
  }
}

export async function assignPermissionToRole(
  roleId: number,
  permissionId: number,
) {
  try {
    const rolePermission = await db.rolePermission.create({
      data: {
        role_id: roleId,
        permission_id: permissionId,
      },
    });

    revalidatePath('/dashboard/roles');
    return { rolePermission };
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
    const rolePermission = await db.rolePermission.delete({
      where: {
        role_id_permission_id: {
          role_id: roleId,
          permission_id: permissionId,
        },
      },
    });

    revalidatePath('/dashboard/roles');
    return { rolePermission };
  } catch (error) {
    console.error('Error al remover el permiso del rol:', error);
    throw new Error('Error al remover el permiso del rol');
  }
}
