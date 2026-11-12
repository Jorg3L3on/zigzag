import type { Company } from '@/db/schema';
import {
  assessCompanyReadiness,
  type CompanyReadinessAssessment,
} from '@/lib/company-readiness';
import {
  buildOperatorFleetRow,
  type OperatorFleetFacts,
  type OperatorFleetRow,
} from '@/lib/company-operator-fleet';

/**
 * The company record the console page shares between header and tabs
 * (ZIG-I38): the fleet row plus what only the page needs.
 */
export type CompanyOperatorSummary = OperatorFleetRow & {
  companyId: number;
  readiness: CompanyReadinessAssessment;
  roleCount: number;
  /** People who never signed in; a pending item in Resumen. */
  neverSignedInCount: number;
  /** Resumen's pending count: alert + missing profile + people never in. */
  pendingCount: number;
};

export const buildCompanyOperatorSummary = (
  companyRow: Company,
  roleCount: number,
  facts?: OperatorFleetFacts,
  now: Date = new Date(),
  neverSignedInCount = 0,
): CompanyOperatorSummary => {
  const row = buildOperatorFleetRow(companyRow, facts, now);
  const archived = row.lifecycle === 'ARCHIVED';
  const pendingCount = archived
    ? 0
    : (row.alert ? 1 : 0) +
      (row.profile.missing > 0 ? 1 : 0) +
      neverSignedInCount;
  return {
    ...row,
    companyId: companyRow.id,
    readiness: assessCompanyReadiness(companyRow),
    roleCount,
    neverSignedInCount,
    pendingCount,
  };
};
