export type OperatorTenantSelection = {
  id: number;
  is_system: boolean;
} | null;

export const TENANT_COMPANY_QUERY_PARAM = 'tenant_company_id';
export const OPERATOR_CONSOLE_COMPANY_QUERY_PARAM = 'company';

/** When a system user has a tenant selected, scope list/create flows to that company. */
export const resolveOperatorTenantCompanyId = (
  isSystemUser: boolean,
  selected: OperatorTenantSelection,
): number | null => {
  if (!isSystemUser || !selected || selected.is_system) {
    return null;
  }
  return selected.id;
};

/** Append or replace `tenant_company_id` on any app path (preserves other query params). */
export const operatorTenantHref = (
  path: string,
  companyId: number,
): string => {
  const qIndex = path.indexOf('?');
  const pathname = qIndex >= 0 ? path.slice(0, qIndex) : path;
  const existingQuery = qIndex >= 0 ? path.slice(qIndex + 1) : '';
  const params = new URLSearchParams(existingQuery);
  params.set(TENANT_COMPANY_QUERY_PARAM, String(companyId));
  return `${pathname}?${params.toString()}`;
};

export const operatorManagementHref = (
  path: '/users' | '/roles',
  companyId: number,
): string => operatorTenantHref(path, companyId);

export const OPERATOR_COMPANY_TABS = [
  'resumen',
  'actividad',
  'acceso',
  'ciclo-de-vida',
] as const;

export type OperatorCompanyTab = (typeof OPERATOR_COMPANY_TABS)[number];

/** The company page in the operator console, one URL per tab (ZIG-I38). */
export const operatorConsoleCompanyHref = (
  companyId: number,
  tab: OperatorCompanyTab = 'resumen',
): string => `/operator-console/${companyId}/${tab}`;
