// create services crud actions
'use server';

import { and, desc, eq, isNotNull, isNull } from 'drizzle-orm';
import { service } from '@/db/schema';
import type { Service } from '@/db/schema';
import { db } from '@/lib/db';
import {
  handleCodedServerActionError,
  type ActionErrorType,
} from '@/lib/errors';
import { requireActionPermission } from '@/lib/security';
import { revalidatePath } from 'next/cache';

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

export async function createService(
  data: CreateServiceData,
): Promise<{
  success: boolean;
  data?: Service;
  error?: string;
  errorType?: ActionErrorType;
}> {
  try {
    const { companyId: effectiveCompanyId } = await requireActionPermission(
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

    revalidatePath('/dashboard/services');
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
    const { companyId: effectiveCompanyId } = await requireActionPermission(
      'services.write',
      updateData.company_id ?? undefined,
    );
    const [updated] = await db
      .update(service)
      .set({
        ...updateData,
        company_id: effectiveCompanyId,
      })
      .where(and(eq(service.id, id), eq(service.company_id, effectiveCompanyId)))
      .returning();

    revalidatePath('/dashboard/services');
    return { success: true, data: updated };
  } catch (error) {
    return handleCodedServerActionError('services.update', 'SV003', error);
  }
}

export async function deleteService(
  id: number,
): Promise<{ success: boolean; error?: string; errorType?: ActionErrorType }> {
  try {
    const { companyId: effectiveCompanyId } =
      await requireActionPermission('services.write');
    await db
      .update(service)
      .set({
        deleted_at: new Date(),
        updated_at: new Date(),
      })
      .where(and(eq(service.id, id), eq(service.company_id, effectiveCompanyId)));

    revalidatePath('/dashboard/services');
    return { success: true };
  } catch (error) {
    return handleCodedServerActionError('services.delete', 'SV004', error);
  }
}
