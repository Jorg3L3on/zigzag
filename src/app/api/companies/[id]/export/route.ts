import { and, eq, isNull } from 'drizzle-orm';
import { company, user } from '@/db/schema';
import {
  buildCompanyExportBundle,
  serializeCompanyExportBundle,
} from '@/lib/company-export';
import { fail, requireApiPermission } from '@/lib/api-helpers';
import { db } from '@/lib/db';
import {
  recordGovernanceAudit,
  sessionUserToGovernanceActor,
} from '@/lib/governance-audit';

type RouteParams = {
  params: Promise<{ id: string }>;
};

const parseCompanyId = (rawId: string) => {
  const companyId = Number.parseInt(rawId, 10);
  if (Number.isNaN(companyId)) {
    return null;
  }
  return companyId;
};

const requireSystemOperator = async (sessionUserId: string) => {
  const sessionUser = await db.query.user.findFirst({
    where: and(eq(user.id, BigInt(sessionUserId)), isNull(user.deleted_at)),
    with: { company: true },
  });

  if (
    !sessionUser ||
    sessionUser.company?.deleted_at ||
    !sessionUser.company?.is_system
  ) {
    return { error: fail('AU002', 403, 'auth') as Response };
  }

  return { sessionUser };
};

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const companyId = parseCompanyId(id);
    if (!companyId) {
      return fail('CO007', 400, 'validation');
    }

    const { session, unauthorized } = await requireApiPermission(
      'companies.read',
      companyId,
    );
    if (unauthorized || !session) {
      return unauthorized;
    }

    const operator = await requireSystemOperator(session.user.id);
    if (operator.error) {
      return operator.error;
    }

    const bundle = await buildCompanyExportBundle(companyId);
    if (!bundle) {
      return fail('CO006', 404, 'validation');
    }

    await recordGovernanceAudit(db, {
      actor: sessionUserToGovernanceActor(session.user),
      resourceType: 'company',
      resourceId: companyId,
      targetCompanyId: companyId,
      eventType: 'export_generated',
      after: {
        export_version: bundle.export_version,
        generated_at: bundle.generated_at,
        counts: bundle.counts,
      },
    });

    const filename = `zigzag-company-${companyId}-export-${bundle.generated_at.slice(0, 10)}.json`;
    const body = serializeCompanyExportBundle(bundle);

    return new Response(body, {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('[COMPANY_EXPORT_GET]', error);
    return fail('CO012', 500, 'server');
  }
}
