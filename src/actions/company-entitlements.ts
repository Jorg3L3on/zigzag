'use server';

import { and, eq, isNull } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { company, plan, type EntitlementLimitOverridesJson } from '@/db/schema';
import { loadCompanyPlanContext } from '@/lib/company-effective-limits';
import { getCompanyEntitlementUsage } from '@/lib/company-entitlement-usage';
import {
  ENTITLEMENT_METRICS,
  ENTITLEMENT_METRIC_LABELS,
  evaluateEntitlement,
  type CompanyPlanId,
  type EntitlementMetric,
} from '@/lib/company-entitlements';
import { db } from '@/lib/db';
import {
  buildActionError,
  handleCodedServerActionError,
  type ActionErrorType,
} from '@/lib/errors';
import {
  actionAuthToGovernanceActor,
  recordGovernanceAudit,
} from '@/lib/governance-audit';
import { listPlans } from '@/lib/plan-catalog';
import {
  requireActionAuth,
  requireActionPermission,
  requireSystemUser,
} from '@/lib/security';

export type CompanyEntitlementSnapshot = {
  plan: CompanyPlanId;
  planLabel: string;
  planId: number;
  usage: Awaited<ReturnType<typeof getCompanyEntitlementUsage>>;
  metrics: Array<{
    metric: EntitlementMetric;
    label: string;
    limit: number | null;
    catalogLimit: number | null;
    usage: number;
    allowed: boolean;
    isOverridden: boolean;
  }>;
};

export async function getCompanyEntitlements(companyId: number): Promise<{
  success: boolean;
  data?: CompanyEntitlementSnapshot;
  error?: string;
  errorType?: ActionErrorType;
}> {
  try {
    await requireActionPermission('companies.read', companyId);
    const authContext = await requireActionAuth();

    if (
      !authContext.companyIsSystem &&
      authContext.companyId !== companyId
    ) {
      return buildActionError('AU002');
    }

    const planContext = await loadCompanyPlanContext(companyId);
    if (!planContext) {
      return buildActionError('CO006');
    }

    const usage = await getCompanyEntitlementUsage(companyId);
    const metrics = ENTITLEMENT_METRICS.map((metric) => {
      const evaluation = evaluateEntitlement(
        planContext.effectiveLimits,
        planContext.planSlug,
        metric,
        usage[metric],
      );
      return {
        metric,
        label: ENTITLEMENT_METRIC_LABELS[metric],
        limit: evaluation.limit,
        catalogLimit: planContext.catalogLimits[metric],
        usage: evaluation.usage,
        allowed: evaluation.allowed,
        isOverridden: planContext.overriddenMetrics.includes(metric),
      };
    });

    return {
      success: true,
      data: {
        plan: planContext.planSlug,
        planLabel: planContext.planLabel,
        planId: planContext.planId,
        usage,
        metrics,
      },
    };
  } catch (error) {
    return handleCodedServerActionError('companies.entitlements', 'CO002', error);
  }
}

export async function listCompanyPlanOptions(): Promise<{
  success: boolean;
  data?: Array<{ id: number; slug: CompanyPlanId; name: string }>;
  error?: string;
  errorType?: ActionErrorType;
}> {
  try {
    await requireActionPermission('companies.read');
    const authContext = await requireActionAuth();
    requireSystemUser(authContext);

    const rows = await listPlans();
    return {
      success: true,
      data: rows.map((row) => ({
        id: row.id,
        slug: row.slug as CompanyPlanId,
        name: row.name,
      })),
    };
  } catch (error) {
    return handleCodedServerActionError('companies.plans.list', 'CO002', error);
  }
}

const planIdSchema = z.number().int().positive();

const overrideMetricSchema = z.number().int().min(0).nullable();

const overridesSchema = z.object({
  users: overrideMetricSchema.optional(),
  clients: overrideMetricSchema.optional(),
  services: overrideMetricSchema.optional(),
  tickets_month: overrideMetricSchema.optional(),
});

const invalidatePlanPaths = (companyId: number) => {
  revalidatePath('/companies');
  revalidatePath(`/companies/${companyId}/edit`);
  revalidatePath('/operator-console');
  revalidatePath('/clients');
  revalidatePath('/services');
  revalidatePath('/tickets');
  revalidatePath('/users');
};

export async function assignCompanyPlan(
  companyId: number,
  planId: number,
): Promise<{
  success: boolean;
  error?: string;
  errorType?: ActionErrorType;
}> {
  try {
    await requireActionPermission('companies.write', companyId);
    const authContext = await requireActionAuth();
    requireSystemUser(authContext);

    const validatedPlanId = planIdSchema.parse(planId);

    const existing = await db.query.company.findFirst({
      where: and(eq(company.id, companyId), isNull(company.deleted_at)),
      with: { plan: true },
    });
    if (!existing || existing.is_system) {
      return buildActionError('CO006');
    }

    const nextPlan = await db.query.plan.findFirst({
      where: eq(plan.id, validatedPlanId),
    });
    if (!nextPlan) {
      return buildActionError('CO007');
    }

    const [updated] = await db
      .update(company)
      .set({ plan_id: validatedPlanId, updated_at: new Date() })
      .where(and(eq(company.id, companyId), isNull(company.deleted_at)))
      .returning();

    await recordGovernanceAudit(db, {
      actor: actionAuthToGovernanceActor(authContext),
      resourceType: 'company',
      resourceId: companyId,
      targetCompanyId: companyId,
      eventType: 'updated',
      before: {
        plan_id: existing.plan_id,
        plan_slug: existing.plan?.slug ?? null,
      },
      after: {
        plan_id: updated.plan_id,
        plan_slug: nextPlan.slug,
      },
    });

    invalidatePlanPaths(companyId);
    return { success: true };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return handleCodedServerActionError('companies.plan.assign.validation', 'CO007', error);
    }
    return handleCodedServerActionError('companies.plan.assign', 'CO004', error);
  }
}

export async function setCompanyEntitlementOverrides(
  companyId: number,
  overrides: EntitlementLimitOverridesJson,
): Promise<{
  success: boolean;
  error?: string;
  errorType?: ActionErrorType;
}> {
  try {
    await requireActionPermission('companies.write', companyId);
    const authContext = await requireActionAuth();
    requireSystemUser(authContext);

    const validated = overridesSchema.parse(overrides);

    const existing = await db.query.company.findFirst({
      where: and(eq(company.id, companyId), isNull(company.deleted_at)),
    });
    if (!existing || existing.is_system) {
      return buildActionError('CO006');
    }

    const merged: EntitlementLimitOverridesJson = {
      ...(existing.entitlement_limit_overrides ?? {}),
      ...validated,
    };

    for (const metric of ENTITLEMENT_METRICS) {
      if (validated[metric] === undefined) {
        continue;
      }
      if (validated[metric] === null) {
        merged[metric] = null;
        continue;
      }
      merged[metric] = validated[metric];
    }

    const [updated] = await db
      .update(company)
      .set({
        entitlement_limit_overrides: merged,
        updated_at: new Date(),
      })
      .where(and(eq(company.id, companyId), isNull(company.deleted_at)))
      .returning();

    await recordGovernanceAudit(db, {
      actor: actionAuthToGovernanceActor(authContext),
      resourceType: 'company',
      resourceId: companyId,
      targetCompanyId: companyId,
      eventType: 'updated',
      before: {
        entitlement_limit_overrides: existing.entitlement_limit_overrides,
      },
      after: {
        entitlement_limit_overrides: updated.entitlement_limit_overrides,
      },
    });

    invalidatePlanPaths(companyId);
    return { success: true };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return handleCodedServerActionError(
        'companies.plan.overrides.validation',
        'CO007',
        error,
      );
    }
    return handleCodedServerActionError('companies.plan.overrides', 'CO004', error);
  }
}

export async function clearCompanyEntitlementOverride(
  companyId: number,
  metric: EntitlementMetric,
): Promise<{
  success: boolean;
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
    if (!existing || existing.is_system) {
      return buildActionError('CO006');
    }

    const nextOverrides = { ...(existing.entitlement_limit_overrides ?? {}) };
    delete nextOverrides[metric];

    const [updated] = await db
      .update(company)
      .set({
        entitlement_limit_overrides:
          Object.keys(nextOverrides).length > 0 ? nextOverrides : null,
        updated_at: new Date(),
      })
      .where(and(eq(company.id, companyId), isNull(company.deleted_at)))
      .returning();

    await recordGovernanceAudit(db, {
      actor: actionAuthToGovernanceActor(authContext),
      resourceType: 'company',
      resourceId: companyId,
      targetCompanyId: companyId,
      eventType: 'updated',
      before: {
        entitlement_limit_overrides: existing.entitlement_limit_overrides,
      },
      after: {
        entitlement_limit_overrides: updated.entitlement_limit_overrides,
      },
    });

    invalidatePlanPaths(companyId);
    return { success: true };
  } catch (error) {
    return handleCodedServerActionError('companies.plan.overrides.clear', 'CO004', error);
  }
}
