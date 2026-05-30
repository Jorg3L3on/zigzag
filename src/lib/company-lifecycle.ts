import type { Company, CompanyLifecycleStatus } from '@/db/schema';

export const COMPANY_LIFECYCLE_STATUSES: CompanyLifecycleStatus[] = [
  'SETUP',
  'ACTIVE',
  'SUSPENDED',
  'ARCHIVED',
];

export const normalizeCompanyLifecycleStatus = (
  status: Company['status'],
): CompanyLifecycleStatus => {
  if (status === 'INACTIVE') {
    return 'SUSPENDED';
  }
  if (COMPANY_LIFECYCLE_STATUSES.includes(status as CompanyLifecycleStatus)) {
    return status as CompanyLifecycleStatus;
  }
  return 'SUSPENDED';
};

export const companyAllowsAuthentication = (
  status: Company['status'],
): boolean => {
  const lifecycle = normalizeCompanyLifecycleStatus(status);
  return lifecycle === 'SETUP' || lifecycle === 'ACTIVE';
};

export const companyLifecycleLabel = (status: Company['status']): string => {
  switch (normalizeCompanyLifecycleStatus(status)) {
    case 'SETUP':
      return 'En configuración';
    case 'ACTIVE':
      return 'Activa';
    case 'SUSPENDED':
      return 'Suspendida';
    case 'ARCHIVED':
      return 'Archivada';
    default:
      return 'Suspendida';
  }
};

export const canTransitionCompanyLifecycle = (
  current: Company['status'],
  next: CompanyLifecycleStatus,
): { allowed: boolean; reason?: string } => {
  const from = normalizeCompanyLifecycleStatus(current);
  if (from === next) {
    return { allowed: true };
  }
  if (from === 'ARCHIVED') {
    return {
      allowed: false,
      reason: 'Las empresas archivadas no pueden cambiar de estado.',
    };
  }
  if (from === 'SUSPENDED' && next === 'SETUP') {
    return {
      allowed: false,
      reason: 'No se puede regresar una empresa suspendida a configuración.',
    };
  }
  return { allowed: true };
};
