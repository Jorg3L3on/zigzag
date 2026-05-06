// /api/companies

import { count, eq, isNull } from 'drizzle-orm';
import { company, service, ticket, user } from '@/db/schema';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

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
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Use token/session claims for read access to avoid hard 404s
    // when a stale session points to a missing user record.
    if (session.user.company_is_system) {
      const companiesList = await db.select().from(company);
      const companies = await attachCounts(companiesList);
      return NextResponse.json(companies);
    }

    if (!session.user.company_id) {
      return NextResponse.json([]);
    }

    const [companyRow] = await db
      .select()
      .from(company)
      .where(eq(company.id, session.user.company_id))
      .limit(1);

    if (!companyRow) {
      return NextResponse.json([]);
    }

    const [withCounts] = await attachCounts([companyRow]);
    return NextResponse.json([withCounts]);
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const sessionUser = await db.query.user.findFirst({
      where: eq(user.id, BigInt(session.user.id)),
      with: { company: true },
    });

    if (!sessionUser || !sessionUser.company?.is_system) {
      return NextResponse.json(
        { error: 'Only system company users can create new companies' },
        { status: 403 },
      );
    }

    const body = await request.json();
    const [created] = await db
      .insert(company)
      .values({
        name: body.name,
        address: body.address,
        phone: body.phone,
        email: body.email,
        logo: body.logo ?? null,
        is_system: false,
      })
      .returning();

    return NextResponse.json(created);
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const sessionUser = await db.query.user.findFirst({
      where: eq(user.id, BigInt(session.user.id)),
      with: { company: true },
    });

    if (!sessionUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const body = await request.json();

    if (!sessionUser.company?.is_system && sessionUser.company_id !== body.id) {
      return NextResponse.json(
        { error: 'You can only update your own company' },
        { status: 403 },
      );
    }

    const [updated] = await db
      .update(company)
      .set({
        name: body.name,
        address: body.address,
        phone: body.phone,
        email: body.email,
        logo: body.logo,
        is_system: sessionUser.company?.is_system ? Boolean(body.is_system) : false,
        updated_at: new Date(),
      })
      .where(eq(company.id, body.id))
      .returning();

    return NextResponse.json(updated);
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
