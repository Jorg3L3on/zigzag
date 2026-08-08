import {
  companyBrandFromSession,
  resolveSidebarCompanyLoadMode,
} from '@/lib/sidebar-company-brand';

describe('resolveSidebarCompanyLoadMode', () => {
  it('waits while permissions are loading', () => {
    expect(
      resolveSidebarCompanyLoadMode({
        permissionsLoading: true,
        isSystem: false,
        canReadCompanies: false,
        canManageCompany: true,
      }),
    ).toBe('wait');
  });

  it('lists companies for system users', () => {
    expect(
      resolveSidebarCompanyLoadMode({
        permissionsLoading: false,
        isSystem: true,
        canReadCompanies: false,
        canManageCompany: false,
      }),
    ).toBe('list');
  });

  it('lists companies when companies.read is granted', () => {
    expect(
      resolveSidebarCompanyLoadMode({
        permissionsLoading: false,
        isSystem: false,
        canReadCompanies: true,
        canManageCompany: false,
      }),
    ).toBe('list');
  });

  it('loads own company for tenant managers without companies.read', () => {
    expect(
      resolveSidebarCompanyLoadMode({
        permissionsLoading: false,
        isSystem: false,
        canReadCompanies: false,
        canManageCompany: true,
      }),
    ).toBe('own');
  });

  it('falls back to session for viewers without company.manage', () => {
    expect(
      resolveSidebarCompanyLoadMode({
        permissionsLoading: false,
        isSystem: false,
        canReadCompanies: false,
        canManageCompany: false,
      }),
    ).toBe('session');
  });
});

describe('companyBrandFromSession', () => {
  it('builds a brand from session fields', () => {
    expect(
      companyBrandFromSession({
        company_id: 5,
        company_name: 'Acme',
        company_is_system: false,
      }),
    ).toEqual({
      id: 5,
      name: 'Acme',
      logo: null,
      is_system: false,
    });
  });

  it('returns null when company identity is missing', () => {
    expect(companyBrandFromSession(null)).toBeNull();
    expect(companyBrandFromSession({ company_id: 5 })).toBeNull();
    expect(
      companyBrandFromSession({ company_name: 'Acme' }),
    ).toBeNull();
  });
});
