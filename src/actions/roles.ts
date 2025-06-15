'use server';

import { db } from '@/lib/db';
import { revalidatePath } from 'next/cache';

interface CreateRoleData {
  name: string;
  description?: string;
  company_id: number;
}

export async function createRole(data: CreateRoleData) {
  try {
    const role = await db.role.create({
      data: {
        name: data.name,
        description: data.description,
        company_id: data.company_id,
        created_at: new Date(),
        updated_at: new Date(),
      },
    });
    revalidatePath('/dashboard/roles');
    return role;
  } catch (error) {
    console.error('Error creating role:', error);
    throw new Error('Error al crear el rol');
  }
}

export async function getRoles() {
  try {
    const roles = await db.role.findMany({
      where: {
        deleted_at: null,
      },
      orderBy: {
        created_at: 'desc',
      },
      include: {
        company: true,
      },
    });
    return roles;
  } catch (error) {
    console.error('Error fetching roles:', error);
    throw new Error('Error al obtener los roles');
  }
}

export async function updateRole(id: number, data: CreateRoleData) {
  try {
    const role = await db.role.update({
      where: { id },
      data: {
        name: data.name,
        description: data.description,
        company_id: data.company_id,
        updated_at: new Date(),
      },
    });
    revalidatePath('/dashboard/roles');
    return role;
  } catch (error) {
    console.error('Error updating role:', error);
    throw new Error('Error al actualizar el rol');
  }
}

export async function deleteRole(id: number) {
  try {
    const role = await db.role.update({
      where: { id },
      data: {
        deleted_at: new Date(),
        updated_at: new Date(),
      },
    });
    revalidatePath('/dashboard/roles');
    return role;
  } catch (error) {
    console.error('Error deleting role:', error);
    throw new Error('Error al eliminar el rol');
  }
}
