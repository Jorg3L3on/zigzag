import type { Company, CompanyLifecycleStatus } from '@/db/schema';
import {
  assessCompanyReadiness,
  companyProductionBlockedMessage,
} from '@/lib/company-readiness';
import {
  canTransitionCompanyLifecycle,
  companyAllowsAuthentication,
  companyLifecycleLabel,
  normalizeCompanyLifecycleStatus,
} from '@/lib/company-lifecycle';

export type CompanyLifecycleChangeValidation = {
  allowed: boolean;
  reason?: string;
  missingLabels?: string[];
  operationalImpact?: string;
};

export const lifecycleOperationalImpact = (
  nextStatus: CompanyLifecycleStatus,
): string => {
  if (nextStatus === 'SUSPENDED' || nextStatus === 'ARCHIVED') {
    return 'Los usuarios de esta empresa no podrán iniciar sesión hasta que se restaure el acceso.';
  }
  if (nextStatus === 'ACTIVE') {
    return 'Los usuarios podrán autenticarse y operar según sus permisos.';
  }
  return 'La empresa permanece en configuración; valide requisitos antes de activar.';
};

export const validateCompanyLifecycleChange = (
  company: Company,
  nextStatus: CompanyLifecycleStatus,
): CompanyLifecycleChangeValidation => {
  if (company.is_system) {
    return {
      allowed: false,
      reason: 'La empresa del sistema no puede cambiar de estado.',
    };
  }

  if (company.deleted_at) {
    return {
      allowed: false,
      reason: 'La empresa fue eliminada.',
    };
  }

  const transition = canTransitionCompanyLifecycle(company.status, nextStatus);
  if (!transition.allowed) {
    return {
      allowed: false,
      reason: transition.reason ?? 'Transición de estado no permitida.',
    };
  }

  const preview = { ...company, status: nextStatus };
  const assessment = assessCompanyReadiness(preview);

  if (nextStatus === 'ACTIVE' && !assessment.productionReady) {
    return {
      allowed: false,
      reason: companyProductionBlockedMessage(assessment),
      missingLabels: assessment.missingLabels,
    };
  }

  return {
    allowed: true,
    operationalImpact: lifecycleOperationalImpact(nextStatus),
  };
};

export const companyLifecycleSummary = (company: Company) => {
  const lifecycle = normalizeCompanyLifecycleStatus(company.status);
  return {
    lifecycle,
    label: companyLifecycleLabel(company.status),
    allowsAuthentication: companyAllowsAuthentication(company.status),
    isArchived: lifecycle === 'ARCHIVED',
  };
};
