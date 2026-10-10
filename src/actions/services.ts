// create services crud actions
'use server';

import { and, asc, desc, eq, ilike, isNotNull, isNull } from 'drizzle-orm';
import { material, service } from '@/db/schema';
import type { Service } from '@/db/schema';
import { db } from '@/lib/db';
import {
  buildActionError,
  handleCodedServerActionError,
  type ActionErrorType,
} from '@/lib/errors';
import { pauseSchedulesForService } from '@/lib/client-service-schedule-lifecycle';
import {
  requireActionAuth,
  requireActionPermission,
  requireTenantActionPermission,
} from '@/lib/security';
import { recordResourceAudit } from '@/lib/resource-audit';
import { revalidatePath } from 'next/cache';
import { roundMoney } from '@/lib/money';
import {
  planServiceCsvImport,
  type ServiceCsvPreviewResult,
  type ServiceCsvPreviewRow,
} from '@/lib/service-csv-preview';
import { serviceWriteSchema, SERVICE_DESCRIPTION_MAX_MESSAGE } from '@/lib/service-description';
import { AppError } from '@/lib/errors';
import type { CsvImportCommitSummary } from '@/lib/csv-import-types';
import { emptyCsvImportCommitSummary } from '@/lib/csv-import-types';
import {
  serviceMaterialsInputSchema,
  type MaterialOption,
  type ParsedServiceMaterial,
  type ServiceMaterialInput,
  type ServiceMaterialView,
} from '@/lib/service-materials';
import {
  loadServiceMaterials,
  replaceServiceMaterials,
} from '@/lib/service-materials-server';

export type ServiceBulkImportSummary = {
  inserted: number;
  failed: number;
  skipped?: number;
  errors: string[];
};

export type ServiceCsvCommitRow = {
  name: string;
  description: string;
  price: number;
};

export interface CreateServiceData {
  name: string;
  description: string;
  price: number;
  company_id: number;
  /** Default materials (ZIG-I10). Omitted on update = left as they are. */
  materials?: ServiceMaterialInput[];
}

export interface UpdateServiceData extends Partial<CreateServiceData> {
  id: number;
}

/** A catalog Service with its default materials (ZIG-I10). */
export type ServiceWithMaterials = Service & { materials: ServiceMaterialView[] };

const parseServiceMaterials = (
  materials: ServiceMaterialInput[] | undefined,
  code: 'SV002' | 'SV003',
):
  | { ok: true; data: ParsedServiceMaterial[] | undefined }
  | { ok: false; error: ReturnType<typeof buildActionError> } => {
  if (materials === undefined) return { ok: true, data: undefined };
  const parsed = serviceMaterialsInputSchema.safeParse(materials);
  if (parsed.success) return { ok: true, data: parsed.data };
  const message = parsed.error.issues[0]?.message ?? 'Revisa los materiales';
  return {
    ok: false,
    error: buildActionError(code, new AppError(message, 400, true, code), 'validation'),
  };
};

export type ServiceStatusFilter = 'active' | 'deleted' | 'all';

export async function getServices(
  companyId: number | null,
  status: ServiceStatusFilter = 'active',
): Promise<{
  success: boolean;
  data?: ServiceWithMaterials[];
  error?: string;
  errorType?: ActionErrorType;
}> {
  try {
    const { companyId: effectiveCompanyId } =
      await requireTenantActionPermission(
        'services.read',
        companyId ?? undefined,
      );
    const companyCondition = eq(service.company_id, effectiveCompanyId);
    const statusCondition =
      status === 'active'
        ? isNull(service.deleted_at)
        : status === 'deleted'
          ? isNotNull(service.deleted_at)
          : undefined;
    const whereCondition = statusCondition
      ? and(companyCondition, statusCondition)
      : companyCondition;

    const services = await db
      .select()
      .from(service)
      .where(whereCondition)
      .orderBy(desc(service.created_at));

    const materialsByService = await loadServiceMaterials(
      db,
      services.map((row) => row.id),
      effectiveCompanyId,
    );

    return {
      success: true,
      data: services.map((row) => ({
        ...row,
        materials: materialsByService.get(row.id) ?? [],
      })),
    };
  } catch (error) {
    return handleCodedServerActionError('services.list', 'SV001', error);
  }
}

export async function getService(id: number): Promise<{
  success: boolean;
  data?: ServiceWithMaterials;
  error?: string;
  errorType?: ActionErrorType;
}> {
  try {
    const context = await requireActionAuth();
    const { companyId } = await requireActionPermission(
      'services.read',
      context.companyIsSystem ? undefined : context.companyId,
    );
    const [row] = await db
      .select()
      .from(service)
      .where(
        context.companyIsSystem
          ? and(eq(service.id, id), isNull(service.deleted_at))
          : and(
              eq(service.id, id),
              eq(service.company_id, companyId),
              isNull(service.deleted_at),
            ),
      )
      .limit(1);

    if (!row) {
      return buildActionError('SV001');
    }

    const materialsByService =
      row.company_id == null
        ? new Map<number, ServiceMaterialView[]>()
        : await loadServiceMaterials(db, [row.id], row.company_id);

    return {
      success: true,
      data: { ...row, materials: materialsByService.get(row.id) ?? [] },
    };
  } catch (error) {
    return handleCodedServerActionError('services.get', 'SV001', error);
  }
}

export async function createService(
  data: CreateServiceData,
): Promise<{
  success: boolean;
  data?: Service;
  error?: string;
  errorType?: ActionErrorType;
}> {
  try {
    const { context, companyId: effectiveCompanyId } =
      await requireTenantActionPermission('services.write', data.company_id);

    const parsed = serviceWriteSchema.safeParse({
      name: data.name,
      description: data.description,
      price: data.price,
    });
    if (!parsed.success) {
      const message =
        parsed.error.issues[0]?.message ?? SERVICE_DESCRIPTION_MAX_MESSAGE;
      return buildActionError(
        'SV002',
        new AppError(message, 400, true, 'SV002'),
        'validation',
      );
    }

    const materials = parseServiceMaterials(data.materials, 'SV002');
    if (!materials.ok) return materials.error;

    // Service + its materials in one transaction (ZIG-I10).
    const created = await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(service)
        .values({
          name: parsed.data.name,
          description: parsed.data.description,
          price: parsed.data.price,
          company_id: effectiveCompanyId,
        })
        .returning();

      const materialResult =
        materials.data && materials.data.length > 0
          ? await replaceServiceMaterials(tx, {
              companyId: effectiveCompanyId,
              serviceId: row.id,
              materials: materials.data,
            })
          : null;

      await recordResourceAudit(tx, {
        actor: context,
        resourceType: 'service',
        resourceId: row.id,
        targetCompanyId: effectiveCompanyId,
        action: 'created',
        after: materialResult
          ? {
              ...row,
              materials: materialResult.rows,
              createdMaterialIds: materialResult.createdMaterialIds,
            }
          : row,
        source: 'action',
      });
      return row;
    });

    revalidatePath('/services');
    return { success: true, data: created };
  } catch (error) {
    return handleCodedServerActionError('services.create', 'SV002', error);
  }
}

export async function updateService(
  data: UpdateServiceData,
): Promise<{
  success: boolean;
  data?: Service;
  error?: string;
  errorType?: ActionErrorType;
}> {
  try {
    const { id, materials: materialsInput, ...updateData } = data;
    const { context, companyId: effectiveCompanyId } =
      await requireTenantActionPermission(
        'services.write',
        updateData.company_id ?? undefined,
      );

    if (
      updateData.name !== undefined ||
      updateData.description !== undefined ||
      updateData.price !== undefined
    ) {
      if (updateData.description !== undefined) {
        const descOnly = serviceWriteSchema.shape.description.safeParse(
          updateData.description,
        );
        if (!descOnly.success) {
          const message =
            descOnly.error.issues[0]?.message ?? SERVICE_DESCRIPTION_MAX_MESSAGE;
          return buildActionError(
            'SV003',
            new AppError(message, 400, true, 'SV003'),
            'validation',
          );
        }
        updateData.description = descOnly.data;
      }
      if (updateData.name !== undefined) {
        const nameOnly = serviceWriteSchema.shape.name.safeParse(updateData.name);
        if (!nameOnly.success) {
          const message = nameOnly.error.issues[0]?.message ?? 'El nombre es obligatorio';
          return buildActionError(
            'SV003',
            new AppError(message, 400, true, 'SV003'),
            'validation',
          );
        }
        updateData.name = nameOnly.data;
      }
      if (updateData.price !== undefined) {
        const priceOnly = serviceWriteSchema.shape.price.safeParse(updateData.price);
        if (!priceOnly.success) {
          const message =
            priceOnly.error.issues[0]?.message ?? 'El precio debe ser un número válido';
          return buildActionError(
            'SV003',
            new AppError(message, 400, true, 'SV003'),
            'validation',
          );
        }
        updateData.price = priceOnly.data;
      }
    }

    const materials = parseServiceMaterials(materialsInput, 'SV003');
    if (!materials.ok) return materials.error;

    const existing = await db.query.service.findFirst({
      where: and(eq(service.id, id), eq(service.company_id, effectiveCompanyId)),
    });
    const updated = await db.transaction(async (tx) => {
      const [row] = await tx
        .update(service)
        .set({
          ...updateData,
          company_id: effectiveCompanyId,
        })
        .where(and(eq(service.id, id), eq(service.company_id, effectiveCompanyId)))
        .returning();

      if (!row) return row;

      // The update matched this company's service, so its materials are ours to replace.
      const materialResult = materials.data
        ? await replaceServiceMaterials(tx, {
            companyId: effectiveCompanyId,
            serviceId: row.id,
            materials: materials.data,
          })
        : null;

      await recordResourceAudit(tx, {
        actor: context,
        resourceType: 'service',
        resourceId: id,
        targetCompanyId: effectiveCompanyId,
        action: 'updated',
        before: existing,
        after: materialResult
          ? {
              ...row,
              materials: materialResult.rows,
              createdMaterialIds: materialResult.createdMaterialIds,
            }
          : row,
        source: 'action',
      });
      return row;
    });

    revalidatePath('/services');
    return { success: true, data: updated };
  } catch (error) {
    return handleCodedServerActionError('services.update', 'SV003', error);
  }
}

export async function deleteService(
  id: number,
  companyId?: number | null,
): Promise<{ success: boolean; error?: string; errorType?: ActionErrorType }> {
  try {
    const { context, companyId: effectiveCompanyId } =
      await requireTenantActionPermission('services.write', companyId);
    const existing = await db.query.service.findFirst({
      where: and(eq(service.id, id), eq(service.company_id, effectiveCompanyId)),
    });
    const [deleted] = await db
      .update(service)
      .set({
        deleted_at: new Date(),
        updated_at: new Date(),
      })
      .where(and(eq(service.id, id), eq(service.company_id, effectiveCompanyId)))
      .returning();

    if (deleted) {
      await recordResourceAudit(db, {
        actor: context,
        resourceType: 'service',
        resourceId: id,
        targetCompanyId: effectiveCompanyId,
        action: 'deleted',
        before: existing,
        after: deleted,
        source: 'action',
      });
    }

    await pauseSchedulesForService(id, effectiveCompanyId);

    revalidatePath('/services');
    revalidatePath('/service-schedules');
    return { success: true };
  } catch (error) {
    return handleCodedServerActionError('services.delete', 'SV004', error);
  }
}

/**
 * Company Material catalog for autocomplete (ZIG-I10): active rows whose name
 * contains the query, alphabetical, at most `limit`. Empty query = first rows.
 */
export async function searchMaterials(
  query: string,
  companyId?: number | null,
  limit = 8,
): Promise<{
  success: boolean;
  data?: MaterialOption[];
  error?: string;
  errorType?: ActionErrorType;
}> {
  try {
    const { companyId: effectiveCompanyId } = await requireTenantActionPermission(
      'services.read',
      companyId ?? undefined,
    );
    const term = query.trim().slice(0, 100).replace(/[\\%_]/g, (c) => `\\${c}`);
    const rows = await db
      .select({
        id: material.id,
        name: material.name,
        unit: material.unit,
        price: material.price,
      })
      .from(material)
      .where(
        and(
          eq(material.company_id, effectiveCompanyId),
          isNull(material.deleted_at),
          term ? ilike(material.name, `%${term}%`) : undefined,
        ),
      )
      .orderBy(asc(material.name))
      .limit(Math.min(Math.max(limit, 1), 20));
    return {
      success: true,
      data: rows.map((row) => ({ ...row, price: Number(row.price) })),
    };
  } catch (error) {
    return handleCodedServerActionError('materials.search', 'SV001', error);
  }
}

/**
 * Dry-run Service CSV import: classify rows without writing.
 */
export async function previewServiceCsvImport(
  records: Array<Record<string, string>>,
  companyId?: number | null,
): Promise<{
  success: boolean;
  data?: ServiceCsvPreviewResult;
  error?: string;
  errorType?: ActionErrorType;
}> {
  try {
    const { companyId: effectiveCompanyId } =
      await requireTenantActionPermission('services.write', companyId);
    const active = await db
      .select({ name: service.name })
      .from(service)
      .where(
        and(
          eq(service.company_id, effectiveCompanyId),
          isNull(service.deleted_at),
        ),
      )
      .orderBy(desc(service.created_at));

    const planned = planServiceCsvImport(
      records,
      active.map((row) => row.name),
    );
    if (!planned.success) {
      return buildActionError(
        'SV002',
        new AppError(planned.error, 400, true, 'SV002'),
        'validation',
      );
    }

    return { success: true, data: planned.data };
  } catch (error) {
    return handleCodedServerActionError('services.importPreview', 'SV002', error);
  }
}

/**
 * Commit one chunk of already-validated Service CSV rows.
 * Re-checks active name duplicates (safe retry) and skips matches.
 */
export async function commitServiceCsvImportChunk(
  rows: ServiceCsvCommitRow[],
  companyId?: number | null,
): Promise<{
  success: boolean;
  data?: CsvImportCommitSummary;
  error?: string;
  errorType?: ActionErrorType;
}> {
  try {
    const { context, companyId: effectiveCompanyId } =
      await requireTenantActionPermission('services.write', companyId);
    const summary = emptyCsvImportCommitSummary();

    const active = await db
      .select({ name: service.name })
      .from(service)
      .where(
        and(
          eq(service.company_id, effectiveCompanyId),
          isNull(service.deleted_at),
        ),
      )
      .orderBy(desc(service.created_at));
    const activeNames = new Set(
      active.map((row) => row.name.trim().toLowerCase()).filter(Boolean),
    );

    for (const row of rows) {
      const parsed = serviceWriteSchema.safeParse(row);
      if (!parsed.success) {
        summary.failed += 1;
        const reason =
          parsed.error.issues[0]?.message ?? 'datos inválidos';
        summary.errors = [...summary.errors, reason];
        summary.reportRows = [
          ...summary.reportRows,
          { rowNumber: 0, status: 'error', reason, name: row.name },
        ];
        continue;
      }

      const nameKey = parsed.data.name.trim().toLowerCase();
      if (activeNames.has(nameKey)) {
        summary.skipped += 1;
        summary.reportRows = [
          ...summary.reportRows,
          {
            rowNumber: 0,
            status: 'skip',
            reason: 'nombre duplicado (activo en catálogo)',
            name: parsed.data.name,
          },
        ];
        continue;
      }

      const [created] = await db
        .insert(service)
        .values({
          name: parsed.data.name,
          description: parsed.data.description,
          price: roundMoney(parsed.data.price),
          company_id: effectiveCompanyId,
        })
        .returning();

      await recordResourceAudit(db, {
        actor: context,
        resourceType: 'service',
        resourceId: created.id,
        targetCompanyId: effectiveCompanyId,
        action: 'created',
        after: created,
        source: 'action',
      });

      activeNames.add(nameKey);
      summary.inserted += 1;
    }

    revalidatePath('/services');
    return { success: true, data: summary };
  } catch (error) {
    return handleCodedServerActionError('services.importChunk', 'SV002', error);
  }
}

/**
 * Bulk-create services from parsed CSV records. Validates each row, skips
 * active duplicates, and rounds prices to cents.
 */
export async function bulkImportServices(
  records: Array<Record<string, string>>,
  companyId?: number | null,
): Promise<{
  success: boolean;
  data?: ServiceBulkImportSummary;
  error?: string;
  errorType?: ActionErrorType;
}> {
  try {
    const { context, companyId: effectiveCompanyId } =
      await requireTenantActionPermission('services.write', companyId);

    const active = await db
      .select({ name: service.name })
      .from(service)
      .where(
        and(
          eq(service.company_id, effectiveCompanyId),
          isNull(service.deleted_at),
        ),
      )
      .orderBy(desc(service.created_at));

    const planned = planServiceCsvImport(
      records,
      active.map((row) => row.name),
    );
    if (!planned.success) {
      return buildActionError(
        'SV002',
        new AppError(planned.error, 400, true, 'SV002'),
        'validation',
      );
    }

    const summary: ServiceBulkImportSummary = {
      inserted: 0,
      failed: planned.data.summary.failed,
      skipped: planned.data.summary.skipped,
      errors: planned.data.rows
        .filter((row) => row.status === 'error' || row.status === 'skip')
        .map((row) => `Fila ${row.rowNumber}: ${row.reason ?? row.status}`),
    };

    const okRows = planned.data.rows.filter(
      (row): row is ServiceCsvPreviewRow & { status: 'ok' } => row.status === 'ok',
    );

    for (const row of okRows) {
      const [created] = await db
        .insert(service)
        .values({
          name: row.name!,
          description: row.description!,
          price: roundMoney(row.price!),
          company_id: effectiveCompanyId,
        })
        .returning();

      await recordResourceAudit(db, {
        actor: context,
        resourceType: 'service',
        resourceId: created.id,
        targetCompanyId: effectiveCompanyId,
        action: 'created',
        after: created,
        source: 'action',
      });
      summary.inserted += 1;
    }

    revalidatePath('/services');
    return { success: true, data: summary };
  } catch (error) {
    return handleCodedServerActionError('services.import', 'SV002', error);
  }
}
