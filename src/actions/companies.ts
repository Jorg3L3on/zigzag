'use server';

import { db } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

const companySchema = z.object({
  name: z.string().min(1, 'El nombre es requerido'),
  address: z.string().min(1, 'La dirección es requerida'),
  phone: z.string().min(1, 'El teléfono es requerido'),
  email: z.string().email('El correo electrónico no es válido'),
  logo: z.string().optional(),
});

export type CompanyFormData = z.infer<typeof companySchema>;

export async function getCompanies() {
  try {
    const companies = await db.company.findMany({
      include: {
        users: true,
      },
      orderBy: {
        created_at: 'desc',
      },
      where: {
        deleted_at: null,
      },
    });
    return { companies };
  } catch (e) {
    console.error(e);
    return { error: 'Error al obtener las empresas' };
  }
}

export async function createCompany(data: CompanyFormData) {
  try {
    const validatedData = companySchema.parse(data);

    const company = await db.company.create({
      data: {
        name: validatedData.name,
        address: validatedData.address,
        phone: validatedData.phone,
        email: validatedData.email,
        logo: validatedData.logo,
        created_at: new Date(),
        updated_at: new Date(),
      },
    });

    revalidatePath('/dashboard/companies');
    return { company };
  } catch (e) {
    console.error(e);
    if (e instanceof z.ZodError) {
      return { error: e.issues[0]?.message ?? 'Datos inválidos' };
    }
    return { error: 'Error al crear la empresa' };
  }
}

export async function updateCompany(id: number, data: CompanyFormData) {
  try {
    const validatedData = companySchema.parse(data);

    const company = await db.company.update({
      where: { id },
      data: {
        name: validatedData.name,
        address: validatedData.address,
        phone: validatedData.phone,
        email: validatedData.email,
        logo: validatedData.logo,
        updated_at: new Date(),
      },
    });

    revalidatePath('/dashboard/companies');
    return { company };
  } catch (e) {
    console.error(e);
    if (e instanceof z.ZodError) {
      return { error: e.issues[0]?.message ?? 'Datos inválidos' };
    }
    return { error: 'Error al actualizar la empresa' };
  }
}

export async function deleteCompany(id: number) {
  try {
    await db.company.update({
      where: { id },
      data: {
        deleted_at: new Date(),
      },
    });

    revalidatePath('/dashboard/companies');
    return { success: true };
  } catch (e) {
    console.error(e);
    return { error: 'Error al eliminar la empresa' };
  }
}
