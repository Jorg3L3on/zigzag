import type { Company, CompanyLifecycleStatus } from '@/db/schema';
import {
  assessCompanyReadiness,
  type CompanyReadinessAssessment,
} from '@/lib/company-readiness';
import {
  companyAllowsAuthentication,
  companyLifecycleLabel,
  normalizeCompanyLifecycleStatus,
} from '@/lib/company-lifecycle';
import {
  operatorIncidentLabel,
  type OperatorAuditEventLike,
} from '@/lib/operator-audit-incidents';

export type OperatorFleetAuditSnapshot = {
  lastActivityAt: Date | null;
  lastIncidentAt: Date | null;
  lastIncidentLabel: string | null;
};

export type OperatorFleetRow = {
  id: number;
  name: string;
  email: string;
  phone: string;
  logo: string | null;
  is_system: false;
  lifecycle: CompanyLifecycleStatus;
  lifecycleLabel: string;
  allowsAuthentication: boolean;
  productionReady: boolean;
  missingCount: number;
  missingLabels: string[];
  readiness: CompanyReadinessAssessment;
  lastActivityAt: string | null;
  lastIncidentAt: string | null;
  lastIncidentLabel: string | null;
  editHref: string;
};

export type OperatorFleetIncidentSource = OperatorAuditEventLike & {
  occurred_at: Date;
};

export const buildOperatorFleetRow = (
  companyRow: Company,
  audit: OperatorFleetAuditSnapshot = {
    lastActivityAt: null,
    lastIncidentAt: null,
    lastIncidentLabel: null,
  },
): OperatorFleetRow => {
  const lifecycle = normalizeCompanyLifecycleStatus(companyRow.status);
  const readiness = assessCompanyReadiness(companyRow);

  return {
    id: companyRow.id,
    name: companyRow.name,
    email: companyRow.email,
    phone: companyRow.phone,
    logo: companyRow.logo,
    is_system: false,
    lifecycle,
    lifecycleLabel: companyLifecycleLabel(companyRow.status),
    allowsAuthentication: companyAllowsAuthentication(companyRow.status),
    productionReady: readiness.productionReady,
    missingCount: readiness.missing.length,
    missingLabels: readiness.missingLabels,
    readiness,
    lastActivityAt: audit.lastActivityAt
      ? audit.lastActivityAt.toISOString()
      : null,
    lastIncidentAt: audit.lastIncidentAt
      ? audit.lastIncidentAt.toISOString()
      : null,
    lastIncidentLabel: audit.lastIncidentLabel,
    editHref: `/companies/${companyRow.id}/edit`,
  };
};

export const buildFleetIncidentSnapshot = (
  incident: OperatorFleetIncidentSource | null | undefined,
): Pick<
  OperatorFleetAuditSnapshot,
  'lastIncidentAt' | 'lastIncidentLabel'
> => {
  if (!incident) {
    return { lastIncidentAt: null, lastIncidentLabel: null };
  }
  return {
    lastIncidentAt: incident.occurred_at,
    lastIncidentLabel: operatorIncidentLabel(incident),
  };
};
