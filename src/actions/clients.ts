'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';

export interface Client {
  id: number;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  document: string | null;
  created_at: Date;
  updated_at: Date | null;
  deleted_at: Date | null;
  company_id: number | null;
}

export interface CreateClientData {
  name: string;
  phone: string;
  email: string | null;
  address: string | null;
  company_id: number;
}

export interface UpdateClientData extends Partial<CreateClientData> {
  id: number;
}

export async function getClients(companyId: number | null): Promise<{
  success: boolean;
  data?: Client[];
  error?: string;
}> {
  try {
    const clients = await db.client.findMany({
      orderBy: {
        created_at: 'desc',
      },
      where: {
        company_id: companyId,
      },
    });

    return { success: true, data: clients };
  } catch (error) {
    console.error('Error al cargar los clientes:', error);
    return { success: false, error: 'Error al cargar los clientes' };
  }
}

export async function getClient(id: number): Promise<{
  success: boolean;
  data?: Client;
  error?: string;
}> {
  try {
    const client = await db.client.findUnique({
      where: { id },
    });

    if (!client) {
      return { success: false, error: 'Cliente no encontrado' };
    }

    return { success: true, data: client };
  } catch (error) {
    console.error('Error al cargar el cliente:', error);
    return { success: false, error: 'Error al cargar el cliente' };
  }
}

export async function createClient(
  data: CreateClientData,
): Promise<{ success: boolean; data?: Client; error?: string }> {
  try {
    const client = await db.client.create({
      data: {
        name: data.name,
        phone: data.phone,
        email: data.email,
        address: data.address,
        company_id: data.company_id,
      },
    });

    revalidatePath('/dashboard/clients');
    return { success: true, data: client };
  } catch (error) {
    console.error('Error al crear el cliente:', error);
    return { success: false, error: 'Error al crear el cliente' };
  }
}

export async function updateClient(
  data: UpdateClientData,
): Promise<{ success: boolean; data?: Client; error?: string }> {
  try {
    const { id, ...updateData } = data;
    const client = await db.client.update({
      where: { id },
      data: updateData,
    });

    revalidatePath('/dashboard/clients');
    return { success: true, data: client };
  } catch (error) {
    console.error('Error al actualizar el cliente:', error);
    return { success: false, error: 'Error al actualizar el cliente' };
  }
}

export async function deleteClient(
  id: number,
): Promise<{ success: boolean; error?: string }> {
  try {
    await db.client.delete({
      where: { id },
    });

    revalidatePath('/dashboard/clients');
    return { success: true };
  } catch (error) {
    console.error('Error al eliminar el cliente:', error);
    return { success: false, error: 'Error al eliminar el cliente' };
  }
}
