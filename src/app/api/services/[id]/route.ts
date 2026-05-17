import { and, eq, isNull } from 'drizzle-orm';
import { service } from '@/db/schema';
import { db } from '@/lib/db';
import { z } from 'zod';
import { fail, ok, requireApiPermission } from '@/lib/api-helpers';

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const serviceId = Number.parseInt(id, 10);
    if (Number.isNaN(serviceId)) {
      return fail('SV001', 400, 'validation');
    }

    const requestedCompanyId = new URL(request.url).searchParams.get('company_id');
    const { session, unauthorized, companyId } = await requireApiPermission(
      'services.read',
      requestedCompanyId ? Number.parseInt(requestedCompanyId, 10) : undefined,
    );
    if (unauthorized || !session) {
      return unauthorized;
    }

    const [row] = session.user.company_is_system && !requestedCompanyId
      ? await db
          .select()
          .from(service)
          .where(and(eq(service.id, serviceId), isNull(service.deleted_at)))
          .limit(1)
      : await db
          .select()
          .from(service)
          .where(
            and(
              eq(service.id, serviceId),
              eq(service.company_id, companyId as number),
              isNull(service.deleted_at),
            ),
          )
          .limit(1);

    if (!row) {
      return fail('SV001', 404, 'validation');
    }

    const serializedService = {
      ...row,
      id: Number(row.id),
      price: Number(row.price),
    };

    return ok(serializedService);
  } catch (error) {
    console.error('Error fetching service:', error);
    return fail('SV001', 500, 'server');
  }
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const serviceId = Number.parseInt(id, 10);
    if (Number.isNaN(serviceId)) {
      return fail('SV003', 400, 'validation');
    }

    const body = await request.json();
    const parsed = z
      .object({
        name: z.string().min(1),
        description: z.string().min(1),
        price: z.number().nonnegative(),
        company_id: z.number().int().positive().optional(),
      })
      .parse(body);
    const requestedCompanyId =
      parsed.company_id ??
      Number.parseInt(new URL(request.url).searchParams.get('company_id') ?? '', 10);
    const { session, unauthorized, companyId } = await requireApiPermission(
      'services.write',
      Number.isNaN(requestedCompanyId) ? undefined : requestedCompanyId,
    );
    if (unauthorized || !session) {
      return unauthorized;
    }

    const [updated] = await db
      .update(service)
      .set({
        name: parsed.name,
        description: parsed.description,
        price: parsed.price,
        updated_at: new Date(),
      })
      .where(
        session.user.company_is_system && Number.isNaN(requestedCompanyId)
          ? and(eq(service.id, serviceId), isNull(service.deleted_at))
          : and(
              eq(service.id, serviceId),
              eq(service.company_id, companyId as number),
              isNull(service.deleted_at),
            ),
      )
      .returning();

    if (!updated) {
      return fail('SV003', 404, 'validation');
    }

    return ok(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return fail('SV003', 400, 'validation');
    }
    console.error('Error updating service:', error);
    return fail('SV003', 500, 'server');
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const serviceId = Number.parseInt(id, 10);
    if (Number.isNaN(serviceId)) {
      return fail('SV004', 400, 'validation');
    }

    const requestedCompanyId = Number.parseInt(
      new URL(request.url).searchParams.get('company_id') ?? '',
      10,
    );
    const { session, unauthorized, companyId } = await requireApiPermission(
      'services.write',
      Number.isNaN(requestedCompanyId) ? undefined : requestedCompanyId,
    );
    if (unauthorized || !session) {
      return unauthorized;
    }

    const [deleted] = await db
      .update(service)
      .set({ deleted_at: new Date(), updated_at: new Date() })
      .where(
        session.user.company_is_system && Number.isNaN(requestedCompanyId)
          ? and(eq(service.id, serviceId), isNull(service.deleted_at))
          : and(
              eq(service.id, serviceId),
              eq(service.company_id, companyId as number),
              isNull(service.deleted_at),
            ),
      )
      .returning();

    if (!deleted) {
      return fail('SV004', 404, 'validation');
    }

    return ok({ deleted: true });
  } catch (error) {
    console.error('Error deleting service:', error);
    return fail('SV004', 500, 'server');
  }
}
