import { and, eq, isNull } from 'drizzle-orm';
import { company } from '@/db/schema';
import { fail, ok, requireApiPermission } from '@/lib/api-helpers';
import { assessCompanyReadiness } from '@/lib/company-readiness';
import { db } from '@/lib/db';

type RouteParams = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const companyId = Number.parseInt(id, 10);
    if (Number.isNaN(companyId)) {
      return fail('CO007', 400, 'validation');
    }

    const { unauthorized } = await requireApiPermission(
      'companies.read',
      companyId,
    );
    if (unauthorized) {
      return unauthorized;
    }

    const row = await db.query.company.findFirst({
      where: and(eq(company.id, companyId), isNull(company.deleted_at)),
    });

    if (!row) {
      return fail('CO006', 404, 'validation');
    }

    return ok(assessCompanyReadiness(row));
  } catch (error) {
    console.error(error);
    return fail('CO002', 500, 'server');
  }
}
