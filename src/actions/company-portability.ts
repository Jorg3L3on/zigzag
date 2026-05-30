'use server';

import { and, eq, isNull } from 'drizzle-orm';
import { company } from '@/db/schema';
import { db } from '@/lib/db';
import {
  buildCompanyExportBundle,
  serializeCompanyExportBundle,
  type CompanyExportBundle,
} from '@/lib/company-export';
import {
  buildOffboardingSummary,
  canStartCompanyOffboarding,
  type CompanyOffboardingRetentionPolicy,
} from '@/lib/company-offboarding';
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
import {
  requireActionAuth,
  requireActionPermission,
  requireSystemUser,
} from '@/lib/security';
import { revalidatePath } from 'next/cache';

export type CompanyOffboardingResult = {
  company: typeof company.$inferSelect;
  summary: ReturnType<typeof buildOffboardingSummary>;
  retention_policy: CompanyOffboardingRetentionPolicy;
};

export async function exportCompanyData(companyId: number): Promise<{
  success: boolean;
  data?: CompanyExportBundle;
  error?: string;
  errorType?: ActionErrorType;
}> {
  try {
    await requireActionPermission('companies.read', companyId);
    const authContext = await requireActionAuth();
    requireSystemUser(authContext);

    const bundle = await buildCompanyExportBundle(companyId);
    if (!bundle) {
      return buildActionError('CO006');
    }

    await recordGovernanceAudit(db, {
      actor: actionAuthToGovernanceActor(authContext),
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

    return { success: true, data: bundle };
  } catch (error) {
    return handleCodedServerActionError('companies.export', 'CO012', error);
  }
}

export async function downloadCompanyExportJson(companyId: number): Promise<{
  success: boolean;
  data?: { filename: string; content: string };
  error?: string;
  errorType?: ActionErrorType;
}> {
  const result = await exportCompanyData(companyId);
  if (!result.success || !result.data) {
    return {
      success: false,
      error: result.error,
      errorType: result.errorType,
    };
  }

  const filename = `zigzag-company-${companyId}-export-${result.data.generated_at.slice(0, 10)}.json`;
  return {
    success: true,
    data: {
      filename,
      content: serializeCompanyExportBundle(result.data),
    },
  };
}

export async function offboardCompany(companyId: number): Promise<{
  success: boolean;
  data?: CompanyOffboardingResult;
  error?: string;
  errorType?: ActionErrorType;
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

    const eligibility = canStartCompanyOffboarding(existing);
    if (!eligibility.allowed) {
      return buildActionError('CO013');
    }

    const summary = buildOffboardingSummary(existing);

    const [updated] = await db
      .update(company)
      .set({
        status: 'ARCHIVED',
        updated_at: new Date(),
      })
      .where(and(eq(company.id, companyId), isNull(company.deleted_at)))
      .returning();

    await recordGovernanceAudit(db, {
      actor: actionAuthToGovernanceActor(authContext),
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

    revalidatePath('/dashboard/companies');
    revalidatePath(`/dashboard/companies/${companyId}/edit`);

    return {
      success: true,
      data: {
        company: updated,
        summary,
        retention_policy: summary.retention_policy,
      },
    };
  } catch (error) {
    return handleCodedServerActionError('companies.offboard', 'CO013', error);
  }
}
