import {
  filterTenantAssignablePermissionNames,
  isProtectedBootstrapAdminRole,
  TENANT_BOOTSTRAP_ADMIN_ROLE_NAME,
  TENANT_BOOTSTRAP_OPERATOR_ROLE_NAME,
  TENANT_BOOTSTRAP_VIEWER_ROLE_NAME,
  TENANT_EXCLUDED_PERMISSIONS,
  tenantOwnerRoleName,
} from '@/lib/company-bootstrap';
import { PERMISSIONS } from '@/lib/permissions';

describe('company bootstrap', () => {
  it('builds a unique tenant owner role name per company', () => {
    expect(tenantOwnerRoleName(42)).toBe('tenant-admin-42');
  });

  it('protects bootstrap Admin and legacy tenant-admin roles from deletion', () => {
    expect(
      isProtectedBootstrapAdminRole(TENANT_BOOTSTRAP_ADMIN_ROLE_NAME, 42, 42),
    ).toBe(true);
    expect(isProtectedBootstrapAdminRole(tenantOwnerRoleName(42), 42, 42)).toBe(
      true,
    );
    expect(
      isProtectedBootstrapAdminRole(TENANT_BOOTSTRAP_OPERATOR_ROLE_NAME, 42, 42),
    ).toBe(false);
    expect(isProtectedBootstrapAdminRole('Admin', 99, 42)).toBe(false);
  });

  it('excludes platform-only permissions from tenant bootstrap baselines', () => {
    const allNames = Object.values(PERMISSIONS).flatMap((group) =>
      Object.values(group),
    );

    const allowed = filterTenantAssignablePermissionNames(allNames);

    for (const excluded of TENANT_EXCLUDED_PERMISSIONS) {
      expect(allowed).not.toContain(excluded);
    }
    expect(allowed).toContain(PERMISSIONS.tickets.write);
    expect(allowed).toContain(PERMISSIONS.users.write);
    expect(allowed).toContain(PERMISSIONS.roles.write);
    expect(allowed).toContain(PERMISSIONS.permissions.read);
    expect(allowed.length).toBe(
      allNames.length - TENANT_EXCLUDED_PERMISSIONS.length,
    );
  });

  it('documents tenant bootstrap role names aligned with the global catalog', () => {
    expect(TENANT_BOOTSTRAP_ADMIN_ROLE_NAME).toBe('Admin');
    expect(TENANT_BOOTSTRAP_OPERATOR_ROLE_NAME).toBe('Operator');
    expect(TENANT_BOOTSTRAP_VIEWER_ROLE_NAME).toBe('Viewer');
  });
});
