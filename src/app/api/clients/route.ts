import { desc, eq, and, isNull } from 'drizzle-orm';
import { client } from '@/db/schema';
import { db } from '@/lib/db';
import { fail, ok, requireApiPermission } from '@/lib/api-helpers';

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
