import {
  filterTenantOwnerPermissionNames,
  tenantOwnerRoleName,
  TENANT_OWNER_EXCLUDED_PERMISSIONS,
} from '@/lib/company-bootstrap';
import { PERMISSIONS } from '@/lib/permissions';

describe('company bootstrap', () => {
  it('builds a unique tenant owner role name per company', () => {
    expect(tenantOwnerRoleName(42)).toBe('tenant-admin-42');
  });

  it('excludes global company administration permissions from tenant owner baseline', () => {
    const allNames = Object.values(PERMISSIONS).flatMap((group) =>
      Object.values(group),
    );

    const allowed = filterTenantOwnerPermissionNames(allNames);

    expect(allowed).not.toContain(PERMISSIONS.companies.read);
    expect(allowed).not.toContain(PERMISSIONS.companies.write);
    expect(allowed).toContain(PERMISSIONS.tickets.write);
    expect(allowed.length).toBe(
      allNames.length - TENANT_OWNER_EXCLUDED_PERMISSIONS.length,
    );
  });
});
