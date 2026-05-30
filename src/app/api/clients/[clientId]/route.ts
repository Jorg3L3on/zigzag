import { and, eq, isNull } from 'drizzle-orm';
import { client } from '@/db/schema';
import { db } from '@/lib/db';
import { fail, ok, requireApiPermission } from '@/lib/api-helpers';

export async function GET(
  req: Request,
  context: { params: Promise<{ clientId: string }> },
) {
  try {
    const { clientId } = await context.params;
    const requestedCompanyId = new URL(req.url).searchParams.get('company_id');
    const { unauthorized, companyId } = await requireApiPermission(
      'clients.read',
      requestedCompanyId ? Number.parseInt(requestedCompanyId, 10) : undefined,
    );
    if (unauthorized) {
      return unauthorized;
    }

    const [row] = await db
      .select()
      .from(client)
      .where(
        and(
          eq(client.id, parseInt(clientId, 10)),
          eq(client.company_id, companyId as number),
          isNull(client.deleted_at),
        ),
      )
      .limit(1);

    if (!row) {
      return fail('CL006', 404, 'validation');
    }

    return ok(row);
  } catch (error) {
    console.error('[CLIENT_GET]', error);
    return fail('CL002', 500, 'server');
  }
}

export async function PATCH(
  req: Request,
  context: { params: Promise<{ clientId: string }> },
) {
  try {
    const { clientId } = await context.params;
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
    const requestedCompanyId =
      typeof company_id === 'number'
        ? company_id
        : Number.parseInt(new URL(req.url).searchParams.get('company_id') ?? '', 10);
    const { unauthorized, companyId } = await requireApiPermission(
      'clients.write',
      Number.isNaN(requestedCompanyId) ? undefined : requestedCompanyId,
    );
    if (unauthorized) {
      return unauthorized;
    }

    if (!name) {
      return fail('CL007', 400, 'validation');
    }

    const [updated] = await db
      .update(client)
      .set({
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
        updated_at: new Date(),
      })
      .where(
        and(
          eq(client.id, parseInt(clientId, 10)),
          eq(client.company_id, companyId as number),
          isNull(client.deleted_at),
        ),
      )
      .returning();

    if (!updated) {
      return fail('CL006', 404, 'validation');
    }

    return ok(updated);
  } catch (error) {
    console.error('[CLIENT_PATCH]', error);
    return fail('CL004', 500, 'server');
  }
}

export async function DELETE(
  req: Request,
  context: { params: Promise<{ clientId: string }> },
) {
  try {
    const { clientId } = await context.params;
    const requestedCompanyId = new URL(req.url).searchParams.get('company_id');
    const { unauthorized, companyId } = await requireApiPermission(
      'clients.write',
      requestedCompanyId ? Number.parseInt(requestedCompanyId, 10) : undefined,
    );
    if (unauthorized) {
      return unauthorized;
    }

    const [deleted] = await db
      .update(client)
      .set({ deleted_at: new Date() })
      .where(
        and(
          eq(client.id, parseInt(clientId, 10)),
          eq(client.company_id, companyId as number),
          isNull(client.deleted_at),
        ),
      )
      .returning();
    if (!deleted) {
      return fail('CL006', 404, 'validation');
    }

    return ok({ deleted: true });
  } catch (error) {
    console.error('[CLIENT_DELETE]', error);
    return fail('CL005', 500, 'server');
  }
}
