import { fail, ok, requireApiPermission } from '@/lib/api-helpers';
import { loadCompanyOperatorSummary } from '@/lib/company-operator-summary-loader';

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

    const { session, unauthorized } = await requireApiPermission(
      'companies.read',
      companyId,
    );
    if (unauthorized) {
      return unauthorized;
    }

    if (!session.user.company_is_system) {
      return fail('AU002', 403, 'auth');
    }

    const summary = await loadCompanyOperatorSummary(companyId);
    if (!summary) {
      return fail('CO006', 404, 'validation');
    }

    return ok(summary);
  } catch (error) {
    console.error(error);
    return fail('CO002', 500, 'server');
  }
}
