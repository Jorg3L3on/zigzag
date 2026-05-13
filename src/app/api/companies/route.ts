// /api/companies

import { count, eq, isNull } from 'drizzle-orm';
import { company, service, ticket, user } from '@/db/schema';
import { auth } from '@/lib/auth';
import {
  companyApiCreateSchema,
  companyApiUpdateSchema,
  normalizeCompanySettingsForDb,
} from '@/lib/company-schema';
import { db } from '@/lib/db';
import { fail, ok } from '@/lib/api-helpers';

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
    const session = await auth();

    if (!session?.user?.id) {
      return fail('Unauthorized', 401, 'auth');
    }

    // Use token/session claims for read access to avoid hard 404s
    // when a stale session points to a missing user record.
    if (session.user.company_is_system) {
      const companiesList = await db.select().from(company);
      const companies = await attachCounts(companiesList);
      return ok(companies);
    }

    if (!session.user.company_id) {
      return ok([]);
    }

    const [companyRow] = await db
      .select()
      .from(company)
      .where(eq(company.id, session.user.company_id))
      .limit(1);

    if (!companyRow) {
      return ok([]);
    }

    const [withCounts] = await attachCounts([companyRow]);
    return ok([withCounts]);
  } catch (error) {
    console.error(error);
    return fail('Internal server error', 500, 'server');
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return fail('Unauthorized', 401, 'auth');
    }

    const sessionUser = await db.query.user.findFirst({
      where: eq(user.id, BigInt(session.user.id)),
      with: { company: true },
    });

    if (!sessionUser || !sessionUser.company?.is_system) {
      return fail('Only system company users can create new companies', 403, 'auth');
    }

    const raw = await request.json();
    const parsed = companyApiCreateSchema.safeParse(raw);
    if (!parsed.success) {
      return fail(
        parsed.error.issues[0]?.message ?? 'Datos inválidos',
        400,
        'validation',
      );
    }
    const body = parsed.data;
    const settings = normalizeCompanySettingsForDb(body.settings);

    const [created] = await db
      .insert(company)
      .values({
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
        is_system: false,
      })
      .returning();

    return ok(created, 201);
  } catch (error) {
    console.error(error);
    return fail('Internal server error', 500, 'server');
  }
}

export async function PUT(request: Request) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return fail('Unauthorized', 401, 'auth');
    }

    const sessionUser = await db.query.user.findFirst({
      where: eq(user.id, BigInt(session.user.id)),
      with: { company: true },
    });

    if (!sessionUser) {
      return fail('User not found', 404, 'validation');
    }

    const raw = await request.json();
    const parsed = companyApiUpdateSchema.safeParse(raw);
    if (!parsed.success) {
      return fail(
        parsed.error.issues[0]?.message ?? 'Datos inválidos',
        400,
        'validation',
      );
    }
    const body = parsed.data;

    if (!sessionUser.company?.is_system && sessionUser.company_id !== body.id) {
      return fail('You can only update your own company', 403, 'auth');
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
        is_system: sessionUser.company?.is_system
          ? Boolean((raw as { is_system?: unknown }).is_system)
          : false,
        updated_at: new Date(),
      })
      .where(eq(company.id, body.id))
      .returning();

    if (!updated) {
      return fail('Company not found', 404, 'validation');
    }

    return ok(updated);
  } catch (error) {
    console.error(error);
    return fail('Internal server error', 500, 'server');
  }
}
