import {
  resolveWritableCompanyId,
  requireSystemUser,
  type ActionAuthContext,
} from '@/lib/authz-context';

describe('security helpers', () => {
  const regularContext: ActionAuthContext = {
    userId: '1',
    companyId: 10,
    companyIsSystem: false,
  };

  const systemContext: ActionAuthContext = {
    userId: '2',
    companyId: 1,
    companyIsSystem: true,
  };

  it('denies cross-tenant writable company for regular users', () => {
    expect(() => resolveWritableCompanyId(regularContext, 99)).toThrow(
      'Access denied to requested company',
    );
  });

  it('allows requested company for system users', () => {
    expect(resolveWritableCompanyId(systemContext, 99)).toBe(99);
  });

  it('denies system-only operation for regular users', () => {
    expect(() => requireSystemUser(regularContext)).toThrow(
      'System-level access required',
    );
  });
});
