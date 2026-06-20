export type OperatorTenantSelection = {
  id: number;
  is_system: boolean;
} | null;

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

export const operatorManagementHref = (
  path: '/users' | '/roles',
  companyId: number,
): string => `${path}?tenant_company_id=${companyId}`;
