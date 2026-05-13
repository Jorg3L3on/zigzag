'use server';

import { and, desc, eq, isNull } from 'drizzle-orm';
import { company } from '@/db/schema';
import { db } from '@/lib/db';
import {
  companyFormSchema,
  normalizeCompanySettingsForDb,
} from '@/lib/company-schema';
import { classifyServerErrorType, type ActionErrorType } from '@/lib/errors';
import {
  requireActionAuth,
  requireActionPermission,
  requireSystemUser,
} from '@/lib/security';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

export type CompanyFormData = z.infer<typeof companyFormSchema>;

export async function getCompanies(): Promise<{
  success: boolean;
  data?: (typeof company.$inferSelect)[];
  error?: string;
  errorType?: ActionErrorType;
}> {
  try {
    await requireActionPermission('companies.read');
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

/** Readable by users with `companies.read`; non-system users only their own company row. */
export async function getCompany(id: number): Promise<{
  success: boolean;
  data?: typeof company.$inferSelect;
  error?: string;
  errorType?: ActionErrorType;
}> {
  try {
    await requireActionPermission('companies.read');
    const authContext = await requireActionAuth();

    const row = await db.query.company.findFirst({
      where: and(eq(company.id, id), isNull(company.deleted_at)),
    });

    if (!row) {
      return {
        success: false,
        error: 'Empresa no encontrada',
        errorType: 'validation',
      };
    }

    if (
      !authContext.companyIsSystem &&
      row.id !== authContext.companyId
    ) {
      return {
        success: false,
        error: 'Acceso denegado',
        errorType: 'auth',
      };
    }

    return { success: true, data: row };
  } catch (e) {
    console.error(e);
    return {
      success: false,
      error: 'Error al obtener la empresa',
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
    await requireActionPermission('companies.write');
    const authContext = await requireActionAuth();
    requireSystemUser(authContext);

    const validatedData = companyFormSchema.parse(data);
    const settings = normalizeCompanySettingsForDb(validatedData.settings);

    const [created] = await db
      .insert(company)
      .values({
        name: validatedData.name,
        phone: validatedData.phone,
        email: validatedData.email,
        logo: validatedData.logo || null,
        street: validatedData.street,
        interior_number: validatedData.interior_number?.trim()
          ? validatedData.interior_number.trim()
          : null,
        exterior_number: validatedData.exterior_number,
        neighborhood: validatedData.neighborhood,
        city: validatedData.city,
        state: validatedData.state,
        country: validatedData.country,
        postal_code: validatedData.postal_code,
        status: validatedData.status,
        settings,
        updated_at: new Date(),
      })
      .returning();

    revalidatePath('/dashboard/companies');
    revalidatePath('/dashboard/companies/new');
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
    await requireActionPermission('companies.write');
    const authContext = await requireActionAuth();
    requireSystemUser(authContext);

    const validatedData = companyFormSchema.parse(data);
    const settings = normalizeCompanySettingsForDb(validatedData.settings);

    const [updated] = await db
      .update(company)
      .set({
        name: validatedData.name,
        phone: validatedData.phone,
        email: validatedData.email,
        logo: validatedData.logo || null,
        street: validatedData.street,
        interior_number: validatedData.interior_number?.trim()
          ? validatedData.interior_number.trim()
          : null,
        exterior_number: validatedData.exterior_number,
        neighborhood: validatedData.neighborhood,
        city: validatedData.city,
        state: validatedData.state,
        country: validatedData.country,
        postal_code: validatedData.postal_code,
        status: validatedData.status,
        settings,
        updated_at: new Date(),
      })
      .where(eq(company.id, id))
      .returning();

    revalidatePath('/dashboard/companies');
    revalidatePath(`/dashboard/companies/${id}/edit`);
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
    await requireActionPermission('companies.write');
    const authContext = await requireActionAuth();
    requireSystemUser(authContext);

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
