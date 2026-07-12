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
import { requireActionPermission } from '@/lib/security';
import { recordResourceAudit } from '@/lib/resource-audit';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { roundMoney } from '@/lib/money';
import { SERVICE_CSV_HEADERS } from '@/lib/csv-schemas';

const importServiceSchema = z.object({
  name: z.string().trim().min(1),
  description: z.string().trim().min(1),
  price: z.coerce.number().nonnegative(),
});

export type ServiceBulkImportSummary = {
  inserted: number;
  failed: number;
  errors: string[];
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
    const { companyId: effectiveCompanyId } = await requireActionPermission(
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
    const { companyId } = await requireActionPermission('services.read');
    const [row] = await db
      .select()
      .from(service)
      .where(
        and(
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
    const { context, companyId: effectiveCompanyId } = await requireActionPermission(
      'services.write',
      data.company_id,
    );

    const [created] = await db
      .insert(service)
      .values({
        name: data.name,
        description: data.description,
        price: data.price,
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
    const { context, companyId: effectiveCompanyId } = await requireActionPermission(
      'services.write',
      updateData.company_id ?? undefined,
    );
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
): Promise<{ success: boolean; error?: string; errorType?: ActionErrorType }> {
  try {
    const { context, companyId: effectiveCompanyId } =
      await requireActionPermission('services.write');
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
export async function getServicesForExport(): Promise<{
  success: boolean;
  data?: Array<Record<(typeof SERVICE_CSV_HEADERS)[number], string>>;
  error?: string;
  errorType?: ActionErrorType;
}> {
  try {
    const { companyId } = await requireActionPermission('services.read');
    const rows = await db
      .select()
      .from(service)
      .where(and(eq(service.company_id, companyId), isNull(service.deleted_at)))
      .orderBy(desc(service.created_at));

    return {
      success: true,
      data: rows.map((row) => ({
        name: row.name,
        description: row.description,
        price: String(row.price),
      })),
    };
  } catch (error) {
    return handleCodedServerActionError('services.export', 'SV001', error);
  }
}

/**
 * Bulk-create services from parsed CSV records. Validates each row and rounds
 * prices to cents.
 */
export async function bulkImportServices(
  records: Array<Record<string, string>>,
): Promise<{
  success: boolean;
  data?: ServiceBulkImportSummary;
  error?: string;
  errorType?: ActionErrorType;
}> {
  try {
    const { context, companyId } = await requireActionPermission('services.write');

    const summary: ServiceBulkImportSummary = {
      inserted: 0,
      failed: 0,
      errors: [],
    };

    for (let index = 0; index < records.length; index += 1) {
      const rowNumber = index + 2;
      const parsed = importServiceSchema.safeParse(records[index]);
      if (!parsed.success) {
        summary.failed += 1;
        summary.errors.push(
          `Fila ${rowNumber}: nombre, descripción y precio válido requeridos`,
        );
        continue;
      }

      const value = parsed.data;
      const [created] = await db
        .insert(service)
        .values({
          name: value.name,
          description: value.description,
          price: roundMoney(value.price),
          company_id: companyId,
        })
        .returning();

      await recordResourceAudit(db, {
        actor: context,
        resourceType: 'service',
        resourceId: created.id,
        targetCompanyId: companyId,
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
