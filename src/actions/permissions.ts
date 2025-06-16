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
    });
    return { permissions };
  } catch (error) {
    console.error('Error al obtener los permisos:', error);
    return { permissions: [] };
  }
}

export async function getPermissionsByCompany(companyId: number) {
  try {
    const permissions = await db.permission.findMany({
      where: {
        company_id: companyId,
        deleted_at: null,
      },
      orderBy: {
        name: 'asc',
      },
    });
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
    console.error('Error al actualizar permiso:', error);
    throw new Error('Error al actualizar permiso');
  }
}

export async function deletePermission(id: number) {
  try {
    // First delete all role permissions associated with this permission
    await db.rolePermission.deleteMany({
      where: {
        permission_id: id,
      },
    });

    // Then soft delete the permission
    await db.permission.update({
      where: { id },
      data: {
        deleted_at: new Date(),
      },
    });
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
    const rolePermission = await db.rolePermission.create({
      data: {
        role_id: roleId,
        permission_id: permissionId,
        created_at: new Date(),
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
