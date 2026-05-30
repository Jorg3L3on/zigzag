import {
  canStartCompanyOffboarding,
  COMPANY_OFFBOARDING_RETENTION_POLICY,
} from '@/lib/company-offboarding';

describe('company-offboarding', () => {
  it('allows offboarding for active non-system tenants', () => {
    const result = canStartCompanyOffboarding({
      is_system: false,
      status: 'ACTIVE',
      deleted_at: null,
    });

    expect(result.allowed).toBe(true);
  });

  it('blocks offboarding for system company and archived tenants', () => {
    expect(
      canStartCompanyOffboarding({
        is_system: true,
        status: 'ACTIVE',
        deleted_at: null,
      }).allowed,
    ).toBe(false);

    expect(
      canStartCompanyOffboarding({
        is_system: false,
        status: 'ARCHIVED',
        deleted_at: null,
      }).allowed,
    ).toBe(false);
  });

  it('documents non-destructive retention defaults', () => {
    expect(COMPANY_OFFBOARDING_RETENTION_POLICY.destructive_purge_by_default).toBe(
      false,
    );
    expect(COMPANY_OFFBOARDING_RETENTION_POLICY.retention_days_after_archive).toBe(
      90,
    );
  });
});
