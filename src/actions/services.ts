// create services crud actions
'use server';

import { and, desc, eq, isNotNull, isNull } from 'drizzle-orm';
import { service } from '@/db/schema';
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
import { SERVICE_CSV_HEADERS } from '@/lib/service-csv';
import {
  planServiceCsvImport,
  type ServiceCsvPreviewResult,
  type ServiceCsvPreviewRow,
} from '@/lib/service-csv-preview';
import { serviceWriteSchema, SERVICE_DESCRIPTION_MAX_MESSAGE } from '@/lib/service-description';
import { AppError } from '@/lib/errors';
import type { CsvImportCommitSummary } from '@/lib/csv-import-types';
import { emptyCsvImportCommitSummary } from '@/lib/csv-import-types';

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
}

export interface UpdateServiceData extends Partial<CreateServiceData> {
  id: number;
}

export type ServiceStatusFilter = 'active' | 'deleted' | 'all';

export async function getServices(
  companyId: number | null,
  status: ServiceStatusFilter = 'active',
): Promise<{
  success: boolean;
  data?: Service[];
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

    return { success: true, data: services };
  } catch (error) {
    return handleCodedServerActionError('services.list', 'SV001', error);
  }
}

export async function getService(id: number): Promise<{
  success: boolean;
  data?: Service;
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

    return { success: true, data: row };
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

    const [created] = await db
      .insert(service)
      .values({
        name: parsed.data.name,
        description: parsed.data.description,
        price: parsed.data.price,
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
    const { id, ...updateData } = data;
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

    const existing = await db.query.service.findFirst({
      where: and(eq(service.id, id), eq(service.company_id, effectiveCompanyId)),
    });
    const [updated] = await db
      .update(service)
      .set({
        ...updateData,
        company_id: effectiveCompanyId,
      })
      .where(and(eq(service.id, id), eq(service.company_id, effectiveCompanyId)))
      .returning();

    if (updated) {
      await recordResourceAudit(db, {
        actor: context,
        resourceType: 'service',
        resourceId: id,
        targetCompanyId: effectiveCompanyId,
        action: 'updated',
        before: existing,
        after: updated,
        source: 'action',
      });
    }

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

/** Returns all active services for the caller's company as CSV-ready rows. */
export async function getServicesForExport(companyId?: number | null): Promise<{
  success: boolean;
  data?: Array<Record<(typeof SERVICE_CSV_HEADERS)[number], string>>;
  error?: string;
  errorType?: ActionErrorType;
}> {
  try {
    const { companyId: effectiveCompanyId } =
      await requireTenantActionPermission('services.read', companyId);
    const rows = await db
      .select()
      .from(service)
      .where(
        and(
          eq(service.company_id, effectiveCompanyId),
          isNull(service.deleted_at),
        ),
      )
      .orderBy(desc(service.created_at));

    return {
      success: true,
      data: rows.map((row) => ({
        nombre: row.name,
        descripción: row.description,
        precio: String(row.price),
      })),
    };
  } catch (error) {
    return handleCodedServerActionError('services.export', 'SV001', error);
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
