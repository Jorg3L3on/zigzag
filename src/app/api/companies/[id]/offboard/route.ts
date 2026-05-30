import { and, eq, isNull } from 'drizzle-orm';
import { company, user } from '@/db/schema';
import {
  buildOffboardingSummary,
  canStartCompanyOffboarding,
} from '@/lib/company-offboarding';
import { fail, ok, requireApiPermission } from '@/lib/api-helpers';
import { db } from '@/lib/db';
import {
  recordGovernanceAudit,
  sanitizeCompanyForAudit,
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

export async function POST(_request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const companyId = parseCompanyId(id);
    if (!companyId) {
      return fail('CO007', 400, 'validation');
    }

    const { session, unauthorized } = await requireApiPermission(
      'companies.write',
      companyId,
    );
    if (unauthorized || !session) {
      return unauthorized;
    }

    const operator = await requireSystemOperator(session.user.id);
    if (operator.error) {
      return operator.error;
    }

    const existing = await db.query.company.findFirst({
      where: and(eq(company.id, companyId), isNull(company.deleted_at)),
    });
    if (!existing) {
      return fail('CO006', 404, 'validation');
    }

    const eligibility = canStartCompanyOffboarding(existing);
    if (!eligibility.allowed) {
      return fail('CO013', 409, 'validation');
    }

    const summary = buildOffboardingSummary(existing);

    const [updated] = await db
      .update(company)
      .set({ status: 'ARCHIVED', updated_at: new Date() })
      .where(and(eq(company.id, companyId), isNull(company.deleted_at)))
      .returning();

    await recordGovernanceAudit(db, {
      actor: sessionUserToGovernanceActor(session.user),
      resourceType: 'company',
      resourceId: companyId,
      targetCompanyId: companyId,
      eventType: 'offboarded',
      before: sanitizeCompanyForAudit(existing),
      after: {
        ...sanitizeCompanyForAudit(updated),
        offboarding: summary,
      },
    });

    return ok({
      company: updated,
      summary,
      retention_policy: summary.retention_policy,
    });
  } catch (error) {
    console.error('[COMPANY_OFFBOARD_POST]', error);
    return fail('CO013', 500, 'server');
  }
}
