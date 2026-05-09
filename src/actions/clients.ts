'use server';

import { desc, eq, isNull } from 'drizzle-orm';
import { client } from '@/db/schema';
import { db } from '@/lib/db';
import { classifyServerErrorType, type ActionErrorType } from '@/lib/errors';
import { revalidatePath } from 'next/cache';

export type Client = typeof client.$inferSelect;

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
  errorType?: ActionErrorType;
}> {
  try {
    const clients = await db
      .select()
      .from(client)
      .where(
        companyId === null
          ? isNull(client.company_id)
          : eq(client.company_id, companyId),
      )
      .orderBy(desc(client.created_at));

    return { success: true, data: clients };
  } catch (error) {
    console.error('Error al cargar los clientes:', error);
    return {
      success: false,
      error: 'Error al cargar los clientes',
      errorType: classifyServerErrorType(error),
    };
  }
}

export async function getClient(id: number): Promise<{
  success: boolean;
  data?: Client;
  error?: string;
  errorType?: ActionErrorType;
}> {
  try {
    const [row] = await db.select().from(client).where(eq(client.id, id)).limit(1);

    if (!row) {
      return {
        success: false,
        error: 'Cliente no encontrado',
        errorType: 'validation',
      };
    }

    return { success: true, data: row };
  } catch (error) {
    console.error('Error al cargar el cliente:', error);
    return {
      success: false,
      error: 'Error al cargar el cliente',
      errorType: classifyServerErrorType(error),
    };
  }
}

export async function createClient(
  data: CreateClientData,
): Promise<{
  success: boolean;
  data?: Client;
  error?: string;
  errorType?: ActionErrorType;
}> {
  try {
    const [created] = await db
      .insert(client)
      .values({
        name: data.name,
        phone: data.phone,
        email: data.email,
        address: data.address,
        company_id: data.company_id,
      })
      .returning();

    revalidatePath('/dashboard/clients');
    return { success: true, data: created };
  } catch (error) {
    console.error('Error al crear el cliente:', error);
    return {
      success: false,
      error: 'Error al crear el cliente',
      errorType: classifyServerErrorType(error),
    };
  }
}

export async function updateClient(
  data: UpdateClientData,
): Promise<{
  success: boolean;
  data?: Client;
  error?: string;
  errorType?: ActionErrorType;
}> {
  try {
    const { id, ...updateData } = data;
    const [updated] = await db
      .update(client)
      .set(updateData)
      .where(eq(client.id, id))
      .returning();

    revalidatePath('/dashboard/clients');
    return { success: true, data: updated };
  } catch (error) {
    console.error('Error al actualizar el cliente:', error);
    return {
      success: false,
      error: 'Error al actualizar el cliente',
      errorType: classifyServerErrorType(error),
    };
  }
}

export async function deleteClient(
  id: number,
): Promise<{ success: boolean; error?: string; errorType?: ActionErrorType }> {
  try {
    await db.delete(client).where(eq(client.id, id));

    revalidatePath('/dashboard/clients');
    return { success: true };
  } catch (error) {
    console.error('Error al eliminar el cliente:', error);
    return {
      success: false,
      error: 'Error al eliminar el cliente',
      errorType: classifyServerErrorType(error),
    };
  }
}
