import { and, count, eq, isNull, or } from 'drizzle-orm';
import { company, role, user } from '@/db/schema';
import { db } from '@/lib/db';
import { assessCompanyReadiness } from '@/lib/company-readiness';
import { hideShadowedSharedRoles } from '@/lib/role-visibility';
import {
  COMPANY_HUB_TABS,
  type CompanyHubTabKey,
} from '@/lib/company-hub';
import { checkPermission } from '@/lib/security';
import type { ActionAuthContext } from '@/lib/authz-context';

export type CompanyHubSummary = {
  companyName: string;
  productionReady: boolean;
  /** Tabs the caller may open, in display order. */
  tabs: CompanyHubTabKey[];
  counts: Partial<Record<CompanyHubTabKey, number>>;
};

/**
 * Hub chrome data for the caller's own company. Counts are only computed for
 * tabs the caller can read, and always scoped to `context.companyId`.
 */
export async function getCompanyHubSummary(
  context: ActionAuthContext,
): Promise<CompanyHubSummary | null> {
  const companyId = context.companyId;
  if (!companyId) {
    return null;
  }

  const companyRow = await db.query.company.findFirst({
    where: and(eq(company.id, companyId), isNull(company.deleted_at)),
  });
  if (!companyRow) {
    return null;
  }

  const allowed = await Promise.all(
    COMPANY_HUB_TABS.map((tab) =>
      checkPermission(context.userId, companyId, tab.requiredPermission),
    ),
  );
  const tabs = COMPANY_HUB_TABS.filter((_, index) => allowed[index]).map(
    (tab) => tab.key,
  );

  const counts: CompanyHubSummary['counts'] = {};

  if (tabs.includes('equipo')) {
    const [row] = await db
      .select({ value: count() })
      .from(user)
      .where(and(eq(user.company_id, companyId), isNull(user.deleted_at)));
    counts.equipo = Number(row?.value ?? 0);
  }

  if (tabs.includes('roles')) {
    // Same list the Roles tab shows: own roles plus shared ones not shadowed
    // by an own copy (copy-on-write).
    const rows = await db
      .select({ name: role.name, company_id: role.company_id })
      .from(role)
      .where(
        and(
          isNull(role.deleted_at),
          or(eq(role.company_id, companyId), isNull(role.company_id)),
        ),
      );
    counts.roles = hideShadowedSharedRoles(rows).length;
  }

  return {
    companyName: companyRow.name,
    productionReady: assessCompanyReadiness(companyRow).productionReady,
    tabs,
    counts,
  };
}
