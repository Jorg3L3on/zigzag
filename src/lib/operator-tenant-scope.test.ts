import {
  operatorManagementHref,
  resolveOperatorTenantCompanyId,
} from '@/lib/operator-tenant-scope';

describe('operator tenant scope', () => {
  it('scopes to tenant company for system users with tenant context', () => {
    expect(
      resolveOperatorTenantCompanyId(true, { id: 42, is_system: false }),
    ).toBe(42);
  });

  it('does not scope for non-system users or system tenant', () => {
    expect(resolveOperatorTenantCompanyId(false, { id: 42, is_system: false })).toBeNull();
    expect(resolveOperatorTenantCompanyId(true, { id: 1, is_system: true })).toBeNull();
    expect(resolveOperatorTenantCompanyId(true, null)).toBeNull();
  });

  it('builds management links with tenant company query', () => {
    expect(operatorManagementHref('/users', 42)).toBe(
      '/users?tenant_company_id=42',
    );
    expect(operatorManagementHref('/roles', 7)).toBe(
      '/roles?tenant_company_id=7',
    );
  });
});
