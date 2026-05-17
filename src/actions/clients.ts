'use server';

import { and, count, desc, eq, ilike, isNull, or } from 'drizzle-orm';
import { client } from '@/db/schema';
import { db } from '@/lib/db';
import {
  buildActionError,
  handleCodedServerActionError,
  type ActionErrorType,
} from '@/lib/errors';
import { requireActionPermission } from '@/lib/security';
import { revalidatePath } from 'next/cache';

export type Client = typeof client.$inferSelect;

export interface CreateClientData {
  name: string;
  phone: string;
  email: string | null;
  address: string | null;
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
    const { companyId: effectiveCompanyId } = await requireActionPermission(
      'clients.write',
      data.company_id,
    );

    const [created] = await db
      .insert(client)
      .values({
        name: data.name,
        phone: data.phone,
        email: data.email,
        address: data.address,
        company_id: effectiveCompanyId,
      })
      .returning();

    revalidatePath('/dashboard/clients');
    return { success: true, data: created };
  } catch (error) {
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
    const { companyId: effectiveCompanyId } = await requireActionPermission(
      'clients.write',
      data.company_id ?? undefined,
    );

    const { id, ...updateData } = data;
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

    revalidatePath('/dashboard/clients');
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
    const { companyId: effectiveCompanyId } = await requireActionPermission(
      'clients.write',
      companyId ?? undefined,
    );
    await db
      .update(client)
      .set({ deleted_at: new Date() })
      .where(
        and(
          eq(client.id, id),
          eq(client.company_id, effectiveCompanyId),
          isNull(client.deleted_at),
        ),
      );

    revalidatePath('/dashboard/clients');
    return { success: true };
  } catch (error) {
    return handleCodedServerActionError('clients.delete', 'CL005', error);
  }
}
