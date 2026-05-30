import {
  canTransitionCompanyLifecycle,
  companyAllowsAuthentication,
  normalizeCompanyLifecycleStatus,
} from '@/lib/company-lifecycle';

describe('company lifecycle', () => {
  it('maps legacy inactive status to suspended', () => {
    expect(normalizeCompanyLifecycleStatus('INACTIVE')).toBe('SUSPENDED');
  });

  it('allows authentication during setup and active states', () => {
    expect(companyAllowsAuthentication('SETUP')).toBe(true);
    expect(companyAllowsAuthentication('ACTIVE')).toBe(true);
    expect(companyAllowsAuthentication('SUSPENDED')).toBe(false);
  });

  it('blocks archived tenants from changing lifecycle', () => {
    expect(
      canTransitionCompanyLifecycle('ARCHIVED', 'ACTIVE').allowed,
    ).toBe(false);
  });
});
