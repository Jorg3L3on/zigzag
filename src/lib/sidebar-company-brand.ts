/**
 * Sidebar company brand loading strategy.
 *
 * Platform `companies.read` is intentionally excluded from tenant bootstrap
 * roles (`TENANT_EXCLUDED_PERMISSIONS`). The sidebar must not call
 * `getCompanies()` for those users — that yields CO001 and leaves the brand
 * stuck on "Ninguna empresa".
 */

export type SidebarCompanyBrand = {
  id: number;
  name: string;
  logo: string | null;
  is_system: boolean;
};

export type SidebarCompanyLoadMode = 'wait' | 'list' | 'own' | 'session';

export const resolveSidebarCompanyLoadMode = (opts: {
  permissionsLoading: boolean;
  isSystem: boolean;
  canReadCompanies: boolean;
  canManageCompany: boolean;
}): SidebarCompanyLoadMode => {
  if (opts.permissionsLoading) {
    return 'wait';
  }
  if (opts.isSystem || opts.canReadCompanies) {
    return 'list';
  }
  if (opts.canManageCompany) {
    return 'own';
  }
  return 'session';
};

export const companyBrandFromSession = (user: {
  company_id?: number | null;
  company_name?: string | null;
  company_is_system?: boolean | null;
} | null | undefined): SidebarCompanyBrand | null => {
  if (user?.company_id == null || !user.company_name) {
    return null;
  }
  return {
    id: user.company_id,
    name: user.company_name,
    logo: null,
    is_system: Boolean(user.company_is_system),
  };
};
