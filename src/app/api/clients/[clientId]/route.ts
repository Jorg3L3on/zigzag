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
