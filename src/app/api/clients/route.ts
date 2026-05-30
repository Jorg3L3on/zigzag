import { desc, eq, and, isNull } from 'drizzle-orm';
import { client } from '@/db/schema';
import { db } from '@/lib/db';
import { fail, ok, requireApiPermission } from '@/lib/api-helpers';
import {
  assertCompanyEntitlementAllows,
  CompanyEntitlementExceededError,
} from '@/lib/company-entitlement-guard';

export async function GET(request: Request) {
  try {
    const companyIdParam = new URL(request.url).searchParams.get('company_id');
    const requestedCompanyId = companyIdParam
      ? Number.parseInt(companyIdParam, 10)
      : undefined;
    const { unauthorized, companyId } = await requireApiPermission(
      'clients.read',
      requestedCompanyId,
    );
    if (unauthorized) {
      return unauthorized;
    }

    const clients = await db
      .select()
      .from(client)
      .where(
        and(
          eq(client.company_id, companyId as number),
          isNull(client.deleted_at),
        ),
      )
      .orderBy(desc(client.created_at));

    return ok(clients);
  } catch (error) {
    console.error('[CLIENTS_GET]', error);
    return fail('CL001', 500, 'server');
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      name,
      email,
      phone,
      document,
      address,
      street,
      exterior_number,
      interior_number,
      neighborhood,
      city,
      state,
      postal_code,
      country,
      company_id,
    } = body;
    const { unauthorized, companyId } = await requireApiPermission(
      'clients.write',
      typeof company_id === 'number' ? company_id : undefined,
    );
    if (unauthorized) {
      return unauthorized;
    }

    if (!name) {
      return fail('CL007', 400, 'validation');
    }

    await assertCompanyEntitlementAllows(companyId as number, 'clients');

    const [created] = await db
      .insert(client)
      .values({
        name,
        email,
        phone,
        document,
        address,
        street,
        exterior_number,
        interior_number,
        neighborhood,
        city,
        state,
        postal_code,
        country,
        company_id: companyId as number,
      })
      .returning();

    return ok(created, 201);
  } catch (error) {
    if (error instanceof CompanyEntitlementExceededError) {
      return fail('CO011', 403, 'validation');
    }
    console.error('[CLIENTS_POST]', error);
    return fail('CL003', 500, 'server');
  }
}
