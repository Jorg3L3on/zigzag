'use server';

import { and, count, desc, eq, ilike, isNull, or } from 'drizzle-orm';
import { client } from '@/db/schema';
import { db } from '@/lib/db';
import {
  buildActionError,
  handleCodedServerActionError,
  type ActionErrorType,
} from '@/lib/errors';
import { pauseSchedulesForClient } from '@/lib/client-service-schedule-lifecycle';
import {
  assertCompanyEntitlementAllows,
  CompanyEntitlementExceededError,
} from '@/lib/company-entitlement-guard';
import { requireActionPermission } from '@/lib/security';
import { recordResourceAudit } from '@/lib/resource-audit';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { CLIENT_CSV_HEADERS } from '@/lib/csv-schemas';

export type Client = typeof client.$inferSelect;

const importClientSchema = z.object({
  name: z.string().trim().min(1),
  email: z.string().trim().email().optional().or(z.literal('')),
  phone: z.string().trim().optional(),
  document: z.string().trim().optional(),
});

export type BulkImportSummary = {
  inserted: number;
  failed: number;
  errors: string[];
};

export interface CreateClientData {
  name: string;
  phone: string;
  email: string | null;
  address: string | null;
  street: string | null;
  exterior_number: string | null;
  interior_number: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country: string | null;
  company_id: number;
}

export interface UpdateClientData extends Partial<CreateClientData> {
  id: number;
}

export interface GetClientsParams {
  companyId: number | null;
  page?: number;
  pageSize?: number;
  search?: string;
}

export interface PaginatedClientsData {
  items: Client[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export async function getClients(params: GetClientsParams): Promise<{
  success: boolean;
  data?: PaginatedClientsData;
  error?: string;
  errorType?: ActionErrorType;
}> {
  try {
    await requireActionPermission('clients.read', params.companyId ?? undefined);
    const page = Math.max(params.page ?? 1, 1);
    const pageSize = Math.min(Math.max(params.pageSize ?? 20, 1), 100);
    const search = params.search?.trim();
    const companyCondition =
      params.companyId === null
        ? isNull(client.company_id)
        : eq(client.company_id, params.companyId);

    const whereCondition = and(
      companyCondition,
      isNull(client.deleted_at),
      search
        ? or(
            ilike(client.name, `%${search}%`),
            ilike(client.email, `%${search}%`),
            ilike(client.phone, `%${search}%`),
            ilike(client.street, `%${search}%`),
            ilike(client.exterior_number, `%${search}%`),
            ilike(client.interior_number, `%${search}%`),
            ilike(client.neighborhood, `%${search}%`),
            ilike(client.city, `%${search}%`),
            ilike(client.state, `%${search}%`),
            ilike(client.postal_code, `%${search}%`),
            ilike(client.country, `%${search}%`),
          )
        : undefined,
    );

    const [{ total }] = await db
      .select({ total: count() })
      .from(client)
      .where(whereCondition);

    const items = await db
      .select()
      .from(client)
      .where(whereCondition)
      .orderBy(desc(client.created_at))
      .limit(pageSize)
      .offset((page - 1) * pageSize);

    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    return {
      success: true,
      data: {
        items,
        total,
        page,
        pageSize,
        totalPages,
      },
    };
  } catch (error) {
    return handleCodedServerActionError('clients.paginated-list', 'CL001', error);
  }
}

/** Full client roster for the company (list UI). Prefer over paginated `getClients` when sorting/filtering in the browser. */
export async function getClientsList(params: {
  companyId: number | null;
}): Promise<{
  success: boolean;
  data?: Client[];
  error?: string;
  errorType?: ActionErrorType;
}> {
  try {
    await requireActionPermission('clients.read', params.companyId ?? undefined);
    const companyCondition =
      params.companyId === null
        ? isNull(client.company_id)
        : eq(client.company_id, params.companyId);

    const whereCondition = and(companyCondition, isNull(client.deleted_at));

    const items = await db
      .select()
      .from(client)
      .where(whereCondition)
      .orderBy(desc(client.created_at));

    return { success: true, data: items };
  } catch (error) {
    return handleCodedServerActionError('clients.list', 'CL001', error);
  }
}

export async function getClient(id: number): Promise<{
  success: boolean;
  data?: Client;
  error?: string;
  errorType?: ActionErrorType;
}> {
  try {
    const { companyId } = await requireActionPermission('clients.read');
    const [row] = await db
      .select()
      .from(client)
      .where(
        and(
          eq(client.id, id),
          eq(client.company_id, companyId),
          isNull(client.deleted_at),
        ),
      )
      .limit(1);

    if (!row) {
      return buildActionError('CL006');
    }

    return { success: true, data: row };
  } catch (error) {
    return handleCodedServerActionError('clients.get', 'CL002', error);
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
    const { context, companyId: effectiveCompanyId } = await requireActionPermission(
      'clients.write',
      data.company_id,
    );

    await assertCompanyEntitlementAllows(effectiveCompanyId, 'clients');

    const [created] = await db
      .insert(client)
      .values({
        name: data.name,
        phone: data.phone,
        email: data.email,
        address: data.address,
        street: data.street,
        exterior_number: data.exterior_number,
        interior_number: data.interior_number,
        neighborhood: data.neighborhood,
        city: data.city,
        state: data.state,
        postal_code: data.postal_code,
        country: data.country,
        company_id: effectiveCompanyId,
      })
      .returning();

    await recordResourceAudit(db, {
      actor: context,
      resourceType: 'client',
      resourceId: created.id,
      targetCompanyId: effectiveCompanyId,
      action: 'created',
      after: created,
      source: 'action',
    });

    revalidatePath('/clients');
    return { success: true, data: created };
  } catch (error) {
    if (error instanceof CompanyEntitlementExceededError) {
      return handleCodedServerActionError('clients.create.entitlement', 'CO011', error);
    }
    return handleCodedServerActionError('clients.create', 'CL003', error);
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
    const { context, companyId: effectiveCompanyId } = await requireActionPermission(
      'clients.write',
      data.company_id ?? undefined,
    );

    const { id, ...updateData } = data;
    const existing = await db.query.client.findFirst({
      where: and(
        eq(client.id, id),
        eq(client.company_id, effectiveCompanyId),
        isNull(client.deleted_at),
      ),
    });
    const [updated] = await db
      .update(client)
      .set({ ...updateData, company_id: effectiveCompanyId })
      .where(
        and(
          eq(client.id, id),
          eq(client.company_id, effectiveCompanyId),
          isNull(client.deleted_at),
        ),
      )
      .returning();

    if (updated) {
      await recordResourceAudit(db, {
        actor: context,
        resourceType: 'client',
        resourceId: id,
        targetCompanyId: effectiveCompanyId,
        action: 'updated',
        before: existing,
        after: updated,
        source: 'action',
      });
    }

    revalidatePath('/clients');
    return { success: true, data: updated };
  } catch (error) {
    return handleCodedServerActionError('clients.update', 'CL004', error);
  }
}

export async function deleteClient(
  id: number,
  companyId?: number | null,
): Promise<{ success: boolean; error?: string; errorType?: ActionErrorType }> {
  try {
    const { context, companyId: effectiveCompanyId } = await requireActionPermission(
      'clients.write',
      companyId ?? undefined,
    );
    const existing = await db.query.client.findFirst({
      where: and(
        eq(client.id, id),
        eq(client.company_id, effectiveCompanyId),
        isNull(client.deleted_at),
      ),
    });
    const [deleted] = await db
      .update(client)
      .set({ deleted_at: new Date() })
      .where(
        and(
          eq(client.id, id),
          eq(client.company_id, effectiveCompanyId),
          isNull(client.deleted_at),
        ),
      )
      .returning();

    if (deleted) {
      await recordResourceAudit(db, {
        actor: context,
        resourceType: 'client',
        resourceId: id,
        targetCompanyId: effectiveCompanyId,
        action: 'deleted',
        before: existing,
        after: deleted,
        source: 'action',
      });
    }

    await pauseSchedulesForClient(id, effectiveCompanyId);

    revalidatePath('/clients');
    revalidatePath('/service-schedules');
    return { success: true };
  } catch (error) {
    return handleCodedServerActionError('clients.delete', 'CL005', error);
  }
}

/** Returns all active clients for the caller's company as plain CSV-ready rows. */
export async function getClientsForExport(): Promise<{
  success: boolean;
  data?: Array<Record<(typeof CLIENT_CSV_HEADERS)[number], string>>;
  error?: string;
  errorType?: ActionErrorType;
}> {
  try {
    const { companyId } = await requireActionPermission('clients.read');
    const rows = await db
      .select()
      .from(client)
      .where(and(eq(client.company_id, companyId), isNull(client.deleted_at)))
      .orderBy(desc(client.created_at));

    return {
      success: true,
      data: rows.map((row) => ({
        name: row.name,
        email: row.email ?? '',
        phone: row.phone ?? '',
        document: row.document ?? '',
      })),
    };
  } catch (error) {
    return handleCodedServerActionError('clients.export', 'CL001', error);
  }
}

/**
 * Bulk-create clients from parsed CSV records. Each row is validated and the
 * plan entitlement is re-checked before every insert, so the import stops once
 * the company's client limit is reached. Returns a per-row summary.
 */
export async function bulkImportClients(
  records: Array<Record<string, string>>,
): Promise<{
  success: boolean;
  data?: BulkImportSummary;
  error?: string;
  errorType?: ActionErrorType;
}> {
  try {
    const { context, companyId } = await requireActionPermission('clients.write');

    const summary: BulkImportSummary = { inserted: 0, failed: 0, errors: [] };

    for (let index = 0; index < records.length; index += 1) {
      const rowNumber = index + 2; // account for header row
      const parsed = importClientSchema.safeParse(records[index]);
      if (!parsed.success) {
        summary.failed += 1;
        summary.errors.push(`Fila ${rowNumber}: nombre requerido o datos inválidos`);
        continue;
      }

      try {
        await assertCompanyEntitlementAllows(companyId, 'clients');
      } catch (error) {
        if (error instanceof CompanyEntitlementExceededError) {
          summary.errors.push(
            `Fila ${rowNumber}: límite del plan alcanzado; importación detenida`,
          );
          break;
        }
        throw error;
      }

      const value = parsed.data;
      const [created] = await db
        .insert(client)
        .values({
          name: value.name,
          email: value.email ? value.email : null,
          phone: value.phone ? value.phone : null,
          document: value.document ? value.document : null,
          company_id: companyId,
        })
        .returning();

      await recordResourceAudit(db, {
        actor: context,
        resourceType: 'client',
        resourceId: created.id,
        targetCompanyId: companyId,
        action: 'created',
        after: created,
        source: 'action',
      });
      summary.inserted += 1;
    }

    revalidatePath('/clients');
    return { success: true, data: summary };
  } catch (error) {
    return handleCodedServerActionError('clients.import', 'CL003', error);
  }
}
