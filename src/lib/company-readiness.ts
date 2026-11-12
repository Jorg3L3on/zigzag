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

/**
 * What the owner can fix in Mi empresa (ZIG-I32): the profile gaps only. The
 * lifecycle status is the operator console's, so it is never the owner's to-do.
 */
export const ownerReadinessGaps = (assessment: CompanyReadinessAssessment): string[] =>
  assessment.missingLabels.filter(
    (_, index) => assessment.missing[index] !== 'lifecycle.active',
  );

export type CompanyProfileGroupId = 'contact' | 'address' | 'fiscal';

export type CompanyProfileItem = {
  key: Exclude<CompanyReadinessRequirement, 'lifecycle.active'>;
  label: string;
  /** Field name in Editar empresa, used to deep-link «Completar». */
  field: string;
  done: boolean;
};

export type CompanyProfileGroup = {
  id: CompanyProfileGroupId;
  label: string;
  items: CompanyProfileItem[];
};

export type CompanyProfileProgress = {
  total: number;
  done: number;
  missing: number;
  missingLabels: string[];
  groups: CompanyProfileGroup[];
};

const PROFILE_GROUPS: {
  id: CompanyProfileGroupId;
  label: string;
  items: { key: CompanyProfileItem['key']; field: string }[];
}[] = [
  {
    id: 'contact',
    label: 'Contacto',
    items: [
      { key: 'profile.name', field: 'name' },
      { key: 'profile.email', field: 'email' },
      { key: 'profile.phone', field: 'phone' },
    ],
  },
  {
    id: 'address',
    label: 'Dirección',
    items: [
      { key: 'profile.street', field: 'street' },
      { key: 'profile.exterior_number', field: 'exterior_number' },
      { key: 'profile.neighborhood', field: 'neighborhood' },
      { key: 'profile.city', field: 'city' },
      { key: 'profile.state', field: 'state' },
      { key: 'profile.country', field: 'country' },
      { key: 'profile.postal_code', field: 'postal_code' },
    ],
  },
  {
    id: 'fiscal',
    label: 'Datos fiscales',
    items: [
      { key: 'settings.rfc', field: 'rfc' },
      { key: 'settings.default_currency', field: 'default_currency' },
    ],
  },
];

/**
 * The operator console's view of readiness (ZIG-I38): only the 12 profile
 * fields count as pending. The lifecycle status has its own column, so a
 * suspended or archived company with a complete profile has 0 pending.
 */
export const assessCompanyProfile = (
  company: Company,
): CompanyProfileProgress => {
  const gaps = new Set(listCompanyProfileGaps(company));
  const groups = PROFILE_GROUPS.map((group) => ({
    id: group.id,
    label: group.label,
    items: group.items.map((item) => ({
      key: item.key,
      field: item.field,
      label: REQUIREMENT_LABELS[item.key],
      done: !gaps.has(item.key),
    })),
  }));
  const all = groups.flatMap((group) => group.items);
  const missingItems = all.filter((item) => !item.done);
  return {
    total: all.length,
    done: all.length - missingItems.length,
    missing: missingItems.length,
    missingLabels: missingItems.map((item) => item.label),
    groups,
  };
};

export const OWNER_STATUS_NOTE = 'Lo cambia el equipo de ZigZag.';

export const companyProductionBlockedMessage = (
  assessment: CompanyReadinessAssessment,
): string => {
  if (assessment.productionReady) {
    return '';
  }
  return `La empresa no está lista para operar. Completa: ${assessment.missingLabels.join(', ')}.`;
};
