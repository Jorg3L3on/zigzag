'use server';

import { and, desc, eq, isNull } from 'drizzle-orm';
import { company } from '@/db/schema';
import { db } from '@/lib/db';
import {
  companyBootstrapSchema,
  companyFormSchema,
  normalizeCompanySettingsForDb,
  type CompanyBootstrapFormValues,
} from '@/lib/company-schema';
import { bootstrapCompanyTenant } from '@/lib/company-bootstrap';
import {
  canTransitionCompanyLifecycle,
  normalizeCompanyLifecycleStatus,
} from '@/lib/company-lifecycle';
import { listCompanyProfileGaps } from '@/lib/company-readiness';
import { parseCompanyLogoFile } from '@/lib/company-logo-upload';
import {
  deleteCompanyLogoBlob,
  uploadCompanyLogoBlob,
} from '@/lib/company-logo-blob';
import {
  AppError,
  buildActionError,
  handleCodedServerActionError,
  ValidationError,
  type ActionErrorType,
} from '@/lib/errors';
import {
  requireActionAuth,
  requireActionPermission,
  requireSystemUser,
} from '@/lib/security';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

export type CompanyFormData = z.infer<typeof companyFormSchema>;
export type CompanyBootstrapData = CompanyBootstrapFormValues;

export async function getCompanies(): Promise<{
  success: boolean;
  data?: (typeof company.$inferSelect)[];
  error?: string;
  errorType?: ActionErrorType;
}> {
  try {
    const authContext = await requireActionAuth();
    await requireActionPermission('companies.read', authContext.companyId);
    const companies = await db.query.company.findMany({
      where: authContext.companyIsSystem
        ? isNull(company.deleted_at)
        : and(
            isNull(company.deleted_at),
            eq(company.id, authContext.companyId as number),
          ),
      with: {
        users: true,
      },
      orderBy: [desc(company.created_at)],
    });
    return { success: true, data: companies };
  } catch (e) {
    return handleCodedServerActionError('companies.list', 'CO001', e);
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
      return buildActionError('CO006');
    }

    if (
      !authContext.companyIsSystem &&
      row.id !== authContext.companyId
    ) {
      return buildActionError('AU002');
    }

    return { success: true, data: row };
  } catch (e) {
    return handleCodedServerActionError('companies.get', 'CO002', e);
  }
}

export async function createCompany(data: CompanyBootstrapData): Promise<{
  success: boolean;
  data?: typeof company.$inferSelect;
  error?: string;
  errorType?: ActionErrorType;
}> {
  try {
    await requireActionPermission('companies.write');
    const authContext = await requireActionAuth();
    requireSystemUser(authContext);

    const validatedData = companyBootstrapSchema.parse(data);
    const result = await bootstrapCompanyTenant({
      company: validatedData,
      owner: validatedData.owner,
    });

    revalidatePath('/dashboard/companies');
    revalidatePath('/dashboard/companies/new');
    revalidatePath('/dashboard/users');
    return { success: true, data: result.company };
  } catch (e) {
    if (e instanceof z.ZodError) {
      return handleCodedServerActionError('companies.create.validation', 'CO007', e);
    }
    if (
      e &&
      typeof e === 'object' &&
      'code' in e &&
      (e as { code?: string }).code === '23505'
    ) {
      return handleCodedServerActionError('companies.create.owner-email', 'US004', e);
    }
    return handleCodedServerActionError('companies.create', 'CO003', e);
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

    const existing = await db.query.company.findFirst({
      where: and(eq(company.id, id), isNull(company.deleted_at)),
    });
    if (!existing) {
      return buildActionError('CO006');
    }

    const nextLifecycle = normalizeCompanyLifecycleStatus(validatedData.status);
    const transition = canTransitionCompanyLifecycle(
      existing.status,
      nextLifecycle,
    );
    if (!transition.allowed) {
      return buildActionError('CO009');
    }

    const mergedPreview = {
      ...existing,
      name: validatedData.name,
      phone: validatedData.phone,
      email: validatedData.email,
      logo: existing.logo,
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
    };

    if (
      nextLifecycle === 'ACTIVE' &&
      listCompanyProfileGaps(mergedPreview).length > 0
    ) {
      return buildActionError('CO008');
    }

    const [updated] = await db
      .update(company)
      .set({
        name: validatedData.name,
        phone: validatedData.phone,
        email: validatedData.email,
        logo: existing.logo,
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
      .where(and(eq(company.id, id), isNull(company.deleted_at)))
      .returning();

    revalidatePath('/dashboard/companies');
    revalidatePath(`/dashboard/companies/${id}/edit`);
    return { success: true, data: updated };
  } catch (e) {
    if (e instanceof z.ZodError) {
      return handleCodedServerActionError('companies.update.validation', 'CO007', e);
    }
    return handleCodedServerActionError('companies.update', 'CO004', e);
  }
}

const loadWritableCompany = async (id: number) => {
  await requireActionPermission('companies.write', id);
  const authContext = await requireActionAuth();
  requireSystemUser(authContext);

  const row = await db.query.company.findFirst({
    where: and(eq(company.id, id), isNull(company.deleted_at)),
  });

  if (!row || row.is_system) {
    return null;
  }

  return row;
};

export async function uploadCompanyLogo(
  companyId: number,
  formData: FormData,
): Promise<{
  success: boolean;
  data?: typeof company.$inferSelect;
  error?: string;
  errorType?: ActionErrorType;
}> {
  try {
    const existing = await loadWritableCompany(companyId);
    if (!existing) {
      return buildActionError('CO006');
    }

    const file = formData.get('file');
    if (!(file instanceof File)) {
      return buildActionError('CO010');
    }

    const parsed = await parseCompanyLogoFile(file);
    const logoUrl = await uploadCompanyLogoBlob(
      companyId,
      parsed.buffer,
      parsed.contentType,
    );

    if (existing.logo) {
      await deleteCompanyLogoBlob(existing.logo);
    }

    const [updated] = await db
      .update(company)
      .set({ logo: logoUrl, updated_at: new Date() })
      .where(and(eq(company.id, companyId), isNull(company.deleted_at)))
      .returning();

    revalidatePath('/dashboard/companies');
    revalidatePath(`/dashboard/companies/${companyId}/edit`);
    return { success: true, data: updated };
  } catch (e) {
    if (e instanceof ValidationError || e instanceof AppError) {
      return handleCodedServerActionError('companies.logo.upload', 'CO010', e);
    }
    return handleCodedServerActionError('companies.logo.upload', 'CO010', e);
  }
}

export async function removeCompanyLogo(companyId: number): Promise<{
  success: boolean;
  data?: typeof company.$inferSelect;
  error?: string;
  errorType?: ActionErrorType;
}> {
  try {
    const existing = await loadWritableCompany(companyId);
    if (!existing) {
      return buildActionError('CO006');
    }

    if (existing.logo) {
      await deleteCompanyLogoBlob(existing.logo);
    }

    const [updated] = await db
      .update(company)
      .set({ logo: null, updated_at: new Date() })
      .where(and(eq(company.id, companyId), isNull(company.deleted_at)))
      .returning();

    revalidatePath('/dashboard/companies');
    revalidatePath(`/dashboard/companies/${companyId}/edit`);
    return { success: true, data: updated };
  } catch (e) {
    return handleCodedServerActionError('companies.logo.remove', 'CO004', e);
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
      .where(and(eq(company.id, id), isNull(company.deleted_at)));

    revalidatePath('/dashboard/companies');
    return { success: true };
  } catch (e) {
    return handleCodedServerActionError('companies.delete', 'CO005', e);
  }
}
