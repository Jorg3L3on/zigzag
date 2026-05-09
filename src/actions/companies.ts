'use server';

import { desc, eq, isNull } from 'drizzle-orm';
import { company } from '@/db/schema';
import { db } from '@/lib/db';
import { classifyServerErrorType, type ActionErrorType } from '@/lib/errors';
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

export async function getCompanies(): Promise<{
  success: boolean;
  data?: (typeof company.$inferSelect)[];
  error?: string;
  errorType?: ActionErrorType;
}> {
  try {
    const companies = await db.query.company.findMany({
      where: isNull(company.deleted_at),
      with: {
        users: true,
      },
      orderBy: [desc(company.created_at)],
    });
    return { success: true, data: companies };
  } catch (e) {
    console.error(e);
    return {
      success: false,
      error: 'Error al obtener las empresas',
      errorType: classifyServerErrorType(e),
    };
  }
}

export async function createCompany(data: CompanyFormData): Promise<{
  success: boolean;
  data?: typeof company.$inferSelect;
  error?: string;
  errorType?: ActionErrorType;
}> {
  try {
    const validatedData = companySchema.parse(data);

    const [created] = await db
      .insert(company)
      .values({
        name: validatedData.name,
        address: validatedData.address,
        phone: validatedData.phone,
        email: validatedData.email,
        logo: validatedData.logo,
        updated_at: new Date(),
      })
      .returning();

    revalidatePath('/dashboard/companies');
    return { success: true, data: created };
  } catch (e) {
    console.error(e);
    if (e instanceof z.ZodError) {
      return {
        success: false,
        error: e.issues[0]?.message ?? 'Datos inválidos',
        errorType: 'validation',
      };
    }
    return {
      success: false,
      error: 'Error al crear la empresa',
      errorType: classifyServerErrorType(e),
    };
  }
}

export async function updateCompany(
  id: number,
  data: CompanyFormData,
): Promise<{
  success: boolean;
  data?: typeof company.$inferSelect;
  error?: string;
  errorType?: ActionErrorType;
}> {
  try {
    const validatedData = companySchema.parse(data);

    const [updated] = await db
      .update(company)
      .set({
        name: validatedData.name,
        address: validatedData.address,
        phone: validatedData.phone,
        email: validatedData.email,
        logo: validatedData.logo,
        updated_at: new Date(),
      })
      .where(eq(company.id, id))
      .returning();

    revalidatePath('/dashboard/companies');
    return { success: true, data: updated };
  } catch (e) {
    console.error(e);
    if (e instanceof z.ZodError) {
      return {
        success: false,
        error: e.issues[0]?.message ?? 'Datos inválidos',
        errorType: 'validation',
      };
    }
    return {
      success: false,
      error: 'Error al actualizar la empresa',
      errorType: classifyServerErrorType(e),
    };
  }
}

export async function deleteCompany(id: number): Promise<{
  success: boolean;
  error?: string;
  errorType?: ActionErrorType;
}> {
  try {
    await db
      .update(company)
      .set({ deleted_at: new Date() })
      .where(eq(company.id, id));

    revalidatePath('/dashboard/companies');
    return { success: true };
  } catch (e) {
    console.error(e);
    return {
      success: false,
      error: 'Error al eliminar la empresa',
      errorType: classifyServerErrorType(e),
    };
  }
}
