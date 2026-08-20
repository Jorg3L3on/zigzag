'use server';

import { and, count, eq, isNull } from 'drizzle-orm';
import { company, user } from '@/db/schema';
import { db } from '@/lib/db';
import {
  resolveExperienceMode,
  type ExperienceMode,
} from '@/lib/experience-mode';
import { requireActionPermission } from '@/lib/security';

/**
 * Resolve campo | office for a company (session-scoped).
 * Used by dashboard SSR to avoid chart flash on campo tenants.
 */
export const loadExperienceModeForCompany = async (
  companyId: number,
): Promise<ExperienceMode> => {
  await requireActionPermission('tickets.read', companyId);

  const [companyRow] = await db
    .select({
      settings: company.settings,
      is_system: company.is_system,
    })
    .from(company)
    .where(and(eq(company.id, companyId), isNull(company.deleted_at)))
    .limit(1);

  if (!companyRow) {
    return 'office';
  }

  const [userCountRow] = await db
    .select({ value: count() })
    .from(user)
    .where(and(eq(user.company_id, companyId), isNull(user.deleted_at)));

  return resolveExperienceMode(companyRow.settings, {
    totalUsers: Number(userCountRow?.value ?? 0),
    isSystemCompany: Boolean(companyRow.is_system),
  });
};
