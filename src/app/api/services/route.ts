import { and, asc, eq, isNotNull, isNull } from 'drizzle-orm';
import { service } from '@/db/schema';
import { fail, ok, requireSession } from '@/lib/api-helpers';
import { db } from '@/lib/db';
import { z } from 'zod';

export async function GET(request: Request) {
  try {
    const { session, unauthorized } = await requireSession();
    if (unauthorized || !session) {
      return unauthorized;
    }

    const companyIdParam = new URL(request.url).searchParams.get('company_id');
    const statusParam = new URL(request.url).searchParams.get('status');
    const parsedCompanyId = companyIdParam ? Number.parseInt(companyIdParam, 10) : null;
    const status =
      statusParam === 'deleted' || statusParam === 'all' ? statusParam : 'active';
    const companyId = session.user.company_is_system
      ? parsedCompanyId ?? session.user.company_id
      : session.user.company_id;

    if (!companyId || Number.isNaN(companyId)) {
      return fail('Invalid company context', 400);
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
    return fail('Failed to fetch services', 500);
  }
}

export async function POST(request: Request) {
  try {
    const { session, unauthorized } = await requireSession();
    if (unauthorized || !session) {
      return unauthorized;
    }

    const body = await request.json();
    const parsed = z
      .object({
        name: z.string().min(1),
        description: z.string().min(1),
        price: z.number().nonnegative(),
      })
      .parse(body);

    const companyId = session.user.company_id;
    if (!companyId) {
      return fail('Invalid company context', 400);
    }

    const [created] = await db
      .insert(service)
      .values({
        name: parsed.name,
        description: parsed.description,
        price: parsed.price,
        company_id: companyId,
      })
      .returning();

    return ok(created, 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return fail(error.issues[0]?.message ?? 'Invalid payload', 400);
    }
    console.error('Error creating service:', error);
    return fail('Error al crear el servicio', 500);
  }
}
