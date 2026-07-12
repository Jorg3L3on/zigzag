import type { Company } from '@/db/schema';
import {
  assessCompanyReadiness,
  type CompanyReadinessAssessment,
} from '@/lib/company-readiness';
import {
  companyAllowsAuthentication,
  companyLifecycleLabel,
  normalizeCompanyLifecycleStatus,
} from '@/lib/company-lifecycle';

export type CompanyOperatorSummary = {
  companyId: number;
  name: string;
  email: string;
  phone: string;
  lifecycle: ReturnType<typeof normalizeCompanyLifecycleStatus>;
  lifecycleLabel: string;
  allowsAuthentication: boolean;
  readiness: CompanyReadinessAssessment;
  roleCount: number;
  editHref: string;
};

export const buildCompanyOperatorSummary = (
  companyRow: Company,
  roleCount: number,
): CompanyOperatorSummary => {
  const lifecycle = normalizeCompanyLifecycleStatus(companyRow.status);
  const readiness = assessCompanyReadiness(companyRow);

  return {
    companyId: companyRow.id,
    name: companyRow.name,
    email: companyRow.email,
    phone: companyRow.phone,
    lifecycle,
    lifecycleLabel: companyLifecycleLabel(companyRow.status),
    allowsAuthentication: companyAllowsAuthentication(companyRow.status),
    readiness,
    roleCount,
    editHref: `/companies/${companyRow.id}/edit`,
  };
};
