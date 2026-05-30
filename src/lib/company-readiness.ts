import type { Company } from '@/db/schema';
import { normalizeCompanyLifecycleStatus } from '@/lib/company-lifecycle';

export type CompanyReadinessRequirement =
  | 'profile.name'
  | 'profile.email'
  | 'profile.phone'
  | 'profile.street'
  | 'profile.exterior_number'
  | 'profile.neighborhood'
  | 'profile.city'
  | 'profile.state'
  | 'profile.country'
  | 'profile.postal_code'
  | 'settings.rfc'
  | 'settings.default_currency'
  | 'lifecycle.active';

export type CompanyReadinessAssessment = {
  lifecycle: ReturnType<typeof normalizeCompanyLifecycleStatus>;
  profileReady: boolean;
  productionReady: boolean;
  missing: CompanyReadinessRequirement[];
  missingLabels: string[];
};

const REQUIREMENT_LABELS: Record<CompanyReadinessRequirement, string> = {
  'profile.name': 'Nombre de la empresa',
  'profile.email': 'Correo de la empresa',
  'profile.phone': 'Teléfono',
  'profile.street': 'Calle',
  'profile.exterior_number': 'Número exterior',
  'profile.neighborhood': 'Colonia',
  'profile.city': 'Ciudad',
  'profile.state': 'Estado',
  'profile.country': 'País',
  'profile.postal_code': 'Código postal',
  'settings.rfc': 'RFC en configuración',
  'settings.default_currency': 'Moneda por defecto',
  'lifecycle.active': 'Estado operativo (Activa)',
};

const hasText = (value: string | null | undefined): boolean =>
  Boolean(value?.trim());

export const listCompanyProfileGaps = (
  company: Company,
): CompanyReadinessRequirement[] => {
  const missing: CompanyReadinessRequirement[] = [];

  if (!hasText(company.name)) {
    missing.push('profile.name');
  }
  if (!hasText(company.email)) {
    missing.push('profile.email');
  }
  if (!hasText(company.phone)) {
    missing.push('profile.phone');
  }
  if (!hasText(company.street)) {
    missing.push('profile.street');
  }
  if (!hasText(company.exterior_number)) {
    missing.push('profile.exterior_number');
  }
  if (!hasText(company.neighborhood)) {
    missing.push('profile.neighborhood');
  }
  if (!hasText(company.city)) {
    missing.push('profile.city');
  }
  if (!hasText(company.state)) {
    missing.push('profile.state');
  }
  if (!hasText(company.country)) {
    missing.push('profile.country');
  }
  if (!hasText(company.postal_code)) {
    missing.push('profile.postal_code');
  }
  if (!hasText(company.settings?.rfc)) {
    missing.push('settings.rfc');
  }
  if (!hasText(company.settings?.default_currency)) {
    missing.push('settings.default_currency');
  }

  return missing;
};

export const assessCompanyReadiness = (
  company: Company,
): CompanyReadinessAssessment => {
  const lifecycle = normalizeCompanyLifecycleStatus(company.status);
  const missing = listCompanyProfileGaps(company);
  const profileReady = missing.length === 0;

  if (lifecycle !== 'ACTIVE') {
    missing.push('lifecycle.active');
  }

  const productionReady = profileReady && lifecycle === 'ACTIVE';

  return {
    lifecycle,
    profileReady,
    productionReady,
    missing,
    missingLabels: missing.map((key) => REQUIREMENT_LABELS[key]),
  };
};

export const companyProductionBlockedMessage = (
  assessment: CompanyReadinessAssessment,
): string => {
  if (assessment.productionReady) {
    return '';
  }
  return `La empresa no está lista para operar. Completa: ${assessment.missingLabels.join(', ')}.`;
};
