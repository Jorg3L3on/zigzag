// create services crud actions
'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';

export interface Service {
  id: number;
  name: string;
  description: string;
  price: number;
  created_at: Date;
  updated_at: Date | null;
  deleted_at: Date | null;
  company_id: number | null;
}

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
    const services = await db.service.findMany({
      orderBy: {
        created_at: 'desc',
      },
      where: {
        company_id: companyId,
      },
    });

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
    const service = await db.service.create({
      data: {
        name: data.name,
        description: data.description,
        price: data.price,
        company_id: data.company_id,
      },
    });

    revalidatePath('/dashboard/services');
    return { success: true, data: service };
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
    const service = await db.service.update({
      where: { id },
      data: updateData,
    });

    revalidatePath('/dashboard/services');
    return { success: true, data: service };
  } catch (error) {
    console.error('Error updating service:', error);
    return { success: false, error: 'Error al actualizar el servicio' };
  }
}

export async function deleteService(
  id: number,
): Promise<{ success: boolean; error?: string }> {
  try {
    await db.service.delete({
      where: { id },
    });

    revalidatePath('/dashboard/services');
    return { success: true };
  } catch (error) {
    console.error('Error deleting service:', error);
    return { success: false, error: 'Error al eliminar el servicio' };
  }
}
