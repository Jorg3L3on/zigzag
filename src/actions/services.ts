// create services crud actions
'use server';

import { desc, eq, isNull } from 'drizzle-orm';
import { service } from '@/db/schema';
import type { Service } from '@/db/schema';
import { db } from '@/lib/db';
import { revalidatePath } from 'next/cache';

export type { Service };

export interface CreateServiceData {
  name: string;
  description: string;
  price: number;
  company_id: number;
}

export interface UpdateServiceData extends Partial<CreateServiceData> {
  id: number;
}

export async function getServices(companyId: number | null): Promise<{
  success: boolean;
  data?: Service[];
  error?: string;
}> {
  try {
    const services = await db
      .select()
      .from(service)
      .where(
        companyId === null
          ? isNull(service.company_id)
          : eq(service.company_id, companyId),
      )
      .orderBy(desc(service.created_at));

    return { success: true, data: services };
  } catch (error) {
    console.error('Error fetching services:', error);
    return { success: false, error: 'Error al cargar los servicios' };
  }
}

export async function createService(
  data: CreateServiceData,
): Promise<{ success: boolean; data?: Service; error?: string }> {
  try {
    const [created] = await db
      .insert(service)
      .values({
        name: data.name,
        description: data.description,
        price: data.price,
        company_id: data.company_id,
      })
      .returning();

    revalidatePath('/dashboard/services');
    return { success: true, data: created };
  } catch (error) {
    console.error('Error creating service:', error);
    return { success: false, error: 'Error al crear el servicio' };
  }
}

export async function updateService(
  data: UpdateServiceData,
): Promise<{ success: boolean; data?: Service; error?: string }> {
  try {
    const { id, ...updateData } = data;
    const [updated] = await db
      .update(service)
      .set(updateData)
      .where(eq(service.id, id))
      .returning();

    revalidatePath('/dashboard/services');
    return { success: true, data: updated };
  } catch (error) {
    console.error('Error updating service:', error);
    return { success: false, error: 'Error al actualizar el servicio' };
  }
}

export async function deleteService(
  id: number,
): Promise<{ success: boolean; error?: string }> {
  try {
    await db.delete(service).where(eq(service.id, id));

    revalidatePath('/dashboard/services');
    return { success: true };
  } catch (error) {
    console.error('Error deleting service:', error);
    return { success: false, error: 'Error al eliminar el servicio' };
  }
}
