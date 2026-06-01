'use server';

import { and, eq, isNull } from 'drizzle-orm';
import { company } from '@/db/schema';
import type { CompanyLifecycleStatus } from '@/db/schema';
import { db } from '@/lib/db';
import { validateCompanyLifecycleChange } from '@/lib/company-lifecycle-change';
import {
  buildActionError,
  handleCodedServerActionError,
  type ActionErrorType,
} from '@/lib/errors';
import {
  actionAuthToGovernanceActor,
  recordGovernanceAudit,
  sanitizeCompanyForAudit,
} from '@/lib/governance-audit';
import { revalidatePath } from 'next/cache';
import {
  requireActionAuth,
  requireActionPermission,
  requireSystemUser,
} from '@/lib/security';

export async function setCompanyLifecycleStatus(
  companyId: number,
  nextStatus: CompanyLifecycleStatus,
): Promise<{
  success: boolean;
  data?: typeof company.$inferSelect;
  error?: string;
  errorType?: ActionErrorType;
  missingLabels?: string[];
}> {
  try {
    await requireActionPermission('companies.write', companyId);
    const authContext = await requireActionAuth();
    requireSystemUser(authContext);

    const existing = await db.query.company.findFirst({
      where: and(eq(company.id, companyId), isNull(company.deleted_at)),
    });

    if (!existing) {
      return buildActionError('CO006');
    }

    const validation = validateCompanyLifecycleChange(existing, nextStatus);
    if (!validation.allowed) {
      return {
        success: false,
        error: validation.reason ?? 'No se puede cambiar el estado.',
        errorType: 'validation',
        missingLabels: validation.missingLabels,
      };
    }

    const [updated] = await db
      .update(company)
      .set({ status: nextStatus, updated_at: new Date() })
      .where(and(eq(company.id, companyId), isNull(company.deleted_at)))
      .returning();

    await recordGovernanceAudit(db, {
      actor: actionAuthToGovernanceActor(authContext),
      resourceType: 'company',
      resourceId: companyId,
      targetCompanyId: companyId,
      eventType: 'updated',
      before: sanitizeCompanyForAudit(existing),
      after: sanitizeCompanyForAudit(updated),
    });

    revalidatePath('/dashboard/companies');
    revalidatePath(`/dashboard/companies/${companyId}/edit`);
    revalidatePath('/dashboard/operator-console');

    return { success: true, data: updated };
  } catch (error) {
    return handleCodedServerActionError('companies.lifecycle', 'CO009', error);
  }
}
