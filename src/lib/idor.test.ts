import {
  resolveWritableCompanyId,
  requireSystemUser,
  type ActionAuthContext,
} from '@/lib/authz-context';
import { AuthorizationError } from '@/lib/errors';

const tenant: ActionAuthContext = {
  userId: '5',
  companyId: 10,
  companyIsSystem: false,
};

const operator: ActionAuthContext = {
  userId: '1',
  companyId: 1,
  companyIsSystem: true,
};

describe('cross-tenant access (IDOR) guards', () => {
  it('lets a tenant write only within their own company', () => {
    expect(resolveWritableCompanyId(tenant)).toBe(10);
    expect(resolveWritableCompanyId(tenant, 10)).toBe(10);
  });

  it('blocks a tenant from targeting another company id', () => {
    expect(() => resolveWritableCompanyId(tenant, 99)).toThrow(
      AuthorizationError,
    );
  });

  it('lets a system operator target any requested company', () => {
    expect(resolveWritableCompanyId(operator, 99)).toBe(99);
    expect(resolveWritableCompanyId(operator)).toBe(1);
  });

  it('requires a company context for tenants', () => {
    expect(() =>
      resolveWritableCompanyId({ ...tenant, companyId: null }),
    ).toThrow(AuthorizationError);
  });

  it('restricts system-only operations to operators', () => {
    expect(() => requireSystemUser(tenant)).toThrow(AuthorizationError);
    expect(() => requireSystemUser(operator)).not.toThrow();
  });
});
