import type { Company } from '@/db/schema';
import {
  canTransitionCompanyLifecycle,
  normalizeCompanyLifecycleStatus,
} from '@/lib/company-lifecycle';

export const COMPANY_OFFBOARDING_RETENTION_POLICY = {
  policy_version: '1',
  destructive_purge_by_default: false,
  retention_days_after_archive: 90,
  summary:
    'El offboarding archiva la empresa sin borrar datos. Los registros soft-deleted y el historial de auditoría se conservan durante 90 días calendario tras ARCHIVED antes de una purga manual revisada.',
  export_includes_soft_deleted: true,
  login_blocked_when_archived: true,
} as const;

export type CompanyOffboardingRetentionPolicy =
  typeof COMPANY_OFFBOARDING_RETENTION_POLICY;

export const canStartCompanyOffboarding = (
  companyRow: Pick<Company, 'is_system' | 'status' | 'deleted_at'>,
): { allowed: boolean; reason?: string } => {
  if (companyRow.deleted_at) {
    return {
      allowed: false,
      reason: 'La empresa ya fue eliminada.',
    };
  }

  if (companyRow.is_system) {
    return {
      allowed: false,
      reason: 'La empresa del sistema no puede darse de baja.',
    };
  }

  const lifecycle = normalizeCompanyLifecycleStatus(companyRow.status);
  if (lifecycle === 'ARCHIVED') {
    return {
      allowed: false,
      reason: 'La empresa ya está archivada.',
    };
  }

  const transition = canTransitionCompanyLifecycle(
    companyRow.status,
    'ARCHIVED',
  );
  if (!transition.allowed) {
    return {
      allowed: false,
      reason:
        transition.reason ??
        'No se puede iniciar offboarding con el estado actual.',
    };
  }

  return { allowed: true };
};

export const buildOffboardingSummary = (companyRow: Company) => {
  const archivedAt = new Date();
  const retentionEndsAt = new Date(archivedAt);
  retentionEndsAt.setUTCDate(
    retentionEndsAt.getUTCDate() +
      COMPANY_OFFBOARDING_RETENTION_POLICY.retention_days_after_archive,
  );

  return {
    company_id: companyRow.id,
    previous_status: normalizeCompanyLifecycleStatus(companyRow.status),
    next_status: 'ARCHIVED' as const,
    archived_at: archivedAt.toISOString(),
    retention_ends_at: retentionEndsAt.toISOString(),
    retention_policy: COMPANY_OFFBOARDING_RETENTION_POLICY,
  };
};
