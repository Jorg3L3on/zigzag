import type { Company, CompanyLifecycleStatus } from '@/db/schema';
import {
  assessCompanyProfile,
  type CompanyProfileProgress,
} from '@/lib/company-readiness';
import {
  companyAllowsAuthentication,
  companyLifecycleLabel,
  normalizeCompanyLifecycleStatus,
} from '@/lib/company-lifecycle';
import { COMPANY_OFFBOARDING_RETENTION_POLICY } from '@/lib/company-offboarding';
import {
  resolveOperatorAttention,
  type OperatorAttentionReason,
} from '@/lib/operator-attention';
import type { OperatorSecurityAlert } from '@/lib/operator-sign-in-burst';

/** Facts the fleet loader reads per company besides the Company row. */
export type OperatorFleetFacts = {
  peopleCount: number;
  /** Last sign-in by a user of this company (never the operator's actions). */
  lastSignInAt: Date | null;
  alert: OperatorSecurityAlert | null;
  /** When the company entered its current status (from the audit log). */
  statusSince: Date | null;
};

export type OperatorFleetRow = {
  id: number;
  name: string;
  email: string;
  phone: string;
  logo: string | null;
  is_system: false;
  createdAt: string;
  lifecycle: CompanyLifecycleStatus;
  lifecycleLabel: string;
  allowsAuthentication: boolean;
  profile: CompanyProfileProgress;
  peopleCount: number;
  lastSignInAt: string | null;
  alert: OperatorSecurityAlert | null;
  statusSince: string | null;
  /** Archived only: when the 90-day retention ends. */
  retentionEndsAt: string | null;
  attention: OperatorAttentionReason[];
  needsAttention: boolean;
  editHref: string;
};

const DAY_MS = 24 * 60 * 60 * 1000;

export const retentionEndFrom = (archivedAt: Date | null): Date | null =>
  archivedAt
    ? new Date(
        archivedAt.getTime() +
          COMPANY_OFFBOARDING_RETENTION_POLICY.retention_days_after_archive *
            DAY_MS,
      )
    : null;

const EMPTY_FACTS: OperatorFleetFacts = {
  peopleCount: 0,
  lastSignInAt: null,
  alert: null,
  statusSince: null,
};

export const buildOperatorFleetRow = (
  companyRow: Company,
  facts: OperatorFleetFacts = EMPTY_FACTS,
  now: Date = new Date(),
): OperatorFleetRow => {
  const lifecycle = normalizeCompanyLifecycleStatus(companyRow.status);
  const profile = assessCompanyProfile(companyRow);
  const lastSignInAt = facts.lastSignInAt
    ? facts.lastSignInAt.toISOString()
    : null;
  const createdAt = companyRow.created_at.toISOString();
  const attention = resolveOperatorAttention({
    lifecycle,
    profileMissing: profile.missing,
    alert: facts.alert,
    lastSignInAt,
    createdAt,
    now,
  });
  const statusSince =
    facts.statusSince ?? (lifecycle === 'SETUP' ? companyRow.created_at : null);
  const retentionEnd =
    lifecycle === 'ARCHIVED' ? retentionEndFrom(facts.statusSince) : null;

  return {
    id: companyRow.id,
    name: companyRow.name,
    email: companyRow.email,
    phone: companyRow.phone,
    logo: companyRow.logo,
    is_system: false,
    createdAt,
    lifecycle,
    lifecycleLabel: companyLifecycleLabel(companyRow.status),
    allowsAuthentication: companyAllowsAuthentication(companyRow.status),
    profile,
    peopleCount: facts.peopleCount,
    lastSignInAt,
    alert: facts.alert,
    statusSince: statusSince ? statusSince.toISOString() : null,
    retentionEndsAt: retentionEnd ? retentionEnd.toISOString() : null,
    attention,
    needsAttention: attention.length > 0,
    editHref: `/companies/${companyRow.id}/edit`,
  };
};
