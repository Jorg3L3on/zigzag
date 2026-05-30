// /api/companies

import { and, count, eq, isNull } from 'drizzle-orm';
import { company, service, ticket, user } from '@/db/schema';
import {
  companyApiCreateSchema,
  companyApiUpdateSchema,
  normalizeCompanySettingsForDb,
} from '@/lib/company-schema';
import { bootstrapCompanyTenant } from '@/lib/company-bootstrap';
import { db } from '@/lib/db';
import { fail, ok, requireApiPermission } from '@/lib/api-helpers';

const attachCounts = async (rows: (typeof company.$inferSelect)[]) => {
  if (!rows.length) {
    return [];
  }

  const [usersGrouped, ticketsGrouped, servicesGrouped] = await Promise.all([
    db
      .select({ companyId: user.company_id, total: count() })
      .from(user)
      .where(isNull(user.deleted_at))
      .groupBy(user.company_id),
    db
      .select({ companyId: ticket.company_id, total: count() })
      .from(ticket)
      .where(isNull(ticket.deleted_at))
      .groupBy(ticket.company_id),
    db
      .select({ companyId: service.company_id, total: count() })
      .from(service)
      .where(isNull(service.deleted_at))
      .groupBy(service.company_id),
  ]);

  const usersMap = new Map<number, number>();
  const ticketsMap = new Map<number, number>();
  const servicesMap = new Map<number, number>();

  usersGrouped.forEach((row) => {
    if (row.companyId) {
      usersMap.set(row.companyId, Number(row.total));
    }
  });
  ticketsGrouped.forEach((row) => {
    if (row.companyId) {
      ticketsMap.set(row.companyId, Number(row.total));
    }
  });
  servicesGrouped.forEach((row) => {
    if (row.companyId) {
      servicesMap.set(row.companyId, Number(row.total));
    }
  });

  return rows.map((c) => ({
    ...c,
    _count: {
      users: usersMap.get(c.id) ?? 0,
      tickets: ticketsMap.get(c.id) ?? 0,
      services: servicesMap.get(c.id) ?? 0,
    },
  }));
};

export async function GET() {
  try {
    const { session, unauthorized } =
      await requireApiPermission('companies.read');
    if (unauthorized || !session) {
      return unauthorized;
    }

    // Use token/session claims for read access to avoid hard 404s
    // when a stale session points to a missing user record.
    if (session.user.company_is_system) {
      const companiesList = await db
        .select()
        .from(company)
        .where(isNull(company.deleted_at));
      const companies = await attachCounts(companiesList);
      return ok(companies);
    }

    if (!session.user.company_id) {
      return ok([]);
    }

    const [companyRow] = await db
      .select()
      .from(company)
      .where(
        and(
          eq(company.id, session.user.company_id),
          isNull(company.deleted_at),
        ),
      )
      .limit(1);

    if (!companyRow) {
      return ok([]);
    }

    const [withCounts] = await attachCounts([companyRow]);
    return ok([withCounts]);
  } catch (error) {
    console.error(error);
    return fail('CO001', 500, 'server');
  }
}

export async function POST(request: Request) {
  try {
    const { session, unauthorized } =
      await requireApiPermission('companies.write');
    if (unauthorized || !session) {
      return unauthorized;
    }

    const sessionUser = await db.query.user.findFirst({
      where: and(eq(user.id, BigInt(session.user.id)), isNull(user.deleted_at)),
      with: { company: true },
    });

    if (
      !sessionUser ||
      sessionUser.company?.deleted_at ||
      !sessionUser.company?.is_system
    ) {
      return fail('AU002', 403, 'auth');
    }

    const raw = await request.json();
    const parsed = companyApiCreateSchema.safeParse(raw);
    if (!parsed.success) {
      return fail('CO007', 400, 'validation');
    }
    const body = parsed.data;

    const result = await bootstrapCompanyTenant({
      company: body,
      owner: body.owner,
    });

    return ok(
      {
        ...result.company,
        owner_user_id: result.owner.id.toString(),
        owner_role_id: result.ownerRole.id,
      },
      201,
    );
  } catch (error) {
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      (error as { code?: string }).code === '23505'
    ) {
      return fail('US004', 409, 'validation');
    }
    console.error(error);
    return fail('CO003', 500, 'server');
  }
}

export async function PUT(request: Request) {
  try {
    const raw = await request.json();
    const parsed = companyApiUpdateSchema.safeParse(raw);
    if (!parsed.success) {
      return fail('CO007', 400, 'validation');
    }
    const body = parsed.data;

    const { session, unauthorized } = await requireApiPermission(
      'companies.write',
      body.id,
    );
    if (unauthorized || !session) {
      return unauthorized;
    }

    const sessionUser = await db.query.user.findFirst({
      where: and(eq(user.id, BigInt(session.user.id)), isNull(user.deleted_at)),
      with: { company: true },
    });

    if (!sessionUser) {
      return fail('US001', 404, 'validation');
    }

    if (sessionUser.company?.deleted_at || !sessionUser.company?.is_system) {
      return fail('AU002', 403, 'auth');
    }

    const settings = normalizeCompanySettingsForDb(body.settings);

    const [updated] = await db
      .update(company)
      .set({
        name: body.name,
        phone: body.phone,
        email: body.email,
        logo: body.logo || null,
        street: body.street,
        interior_number: body.interior_number?.trim()
          ? body.interior_number.trim()
          : null,
        exterior_number: body.exterior_number,
        neighborhood: body.neighborhood,
        city: body.city,
        state: body.state,
        country: body.country,
        postal_code: body.postal_code,
        status: body.status,
        settings,
        is_system: Boolean((raw as { is_system?: unknown }).is_system),
        updated_at: new Date(),
      })
      .where(and(eq(company.id, body.id), isNull(company.deleted_at)))
      .returning();

    if (!updated) {
      return fail('CO006', 404, 'validation');
    }

    return ok(updated);
  } catch (error) {
    console.error(error);
    return fail('CO004', 500, 'server');
  }
}
