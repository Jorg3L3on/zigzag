import { and, asc, eq, isNotNull, isNull } from 'drizzle-orm';
import { service } from '@/db/schema';
import { fail, ok, requireApiPermission } from '@/lib/api-helpers';
import {
  assertCompanyEntitlementAllows,
  CompanyEntitlementExceededError,
} from '@/lib/company-entitlement-guard';
import { db } from '@/lib/db';
import { z } from 'zod';
import { recordResourceAudit } from '@/lib/resource-audit';

export async function GET(request: Request) {
  try {
    const companyIdParam = new URL(request.url).searchParams.get('company_id');
    const statusParam = new URL(request.url).searchParams.get('status');
    const parsedCompanyId = companyIdParam ? Number.parseInt(companyIdParam, 10) : null;
    const status =
      statusParam === 'deleted' || statusParam === 'all' ? statusParam : 'active';
    const { unauthorized, companyId } = await requireApiPermission(
      'services.read',
      parsedCompanyId,
    );
    if (unauthorized) {
      return unauthorized;
    }

    if (!companyId || Number.isNaN(companyId)) {
      return fail('AU002', 400, 'auth');
    }

    const companyCondition = eq(service.company_id, companyId);
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
      .orderBy(asc(service.name));

    return ok(services);
  } catch (error) {
    console.error('Error fetching services:', error);
    return fail('SV001', 500, 'server');
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = z
      .object({
        name: z.string().min(1),
        description: z.string().min(1),
        price: z.number().nonnegative(),
        company_id: z.number().int().positive().optional(),
      })
      .parse(body);

    const { session, unauthorized, companyId } = await requireApiPermission(
      'services.write',
      parsed.company_id,
      { route: '/api/services', method: 'POST' },
    );
    if (unauthorized || !session) {
      return unauthorized;
    }

    await assertCompanyEntitlementAllows(companyId, 'services');

    const [created] = await db
      .insert(service)
      .values({
        name: parsed.name,
        description: parsed.description,
        price: parsed.price,
        company_id: companyId,
      })
      .returning();

    await recordResourceAudit(db, {
      actor: {
        userId: session.user.id,
        companyId: session.user.company_id ?? null,
        companyIsSystem: Boolean(session.user.company_is_system),
      },
      resourceType: 'service',
      resourceId: created.id,
      targetCompanyId: companyId,
      action: 'created',
      after: created,
      source: 'api',
    });

    return ok(created, 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return fail('SV002', 400, 'validation');
    }
    if (error instanceof CompanyEntitlementExceededError) {
      return fail('CO011', 403, 'validation');
    }
    console.error('Error creating service:', error);
    return fail('SV002', 500, 'server');
  }
}
