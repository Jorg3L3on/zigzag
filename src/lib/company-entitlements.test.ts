import {
  entitlementDeniedMessage,
  evaluateEntitlement,
  getCompanyPlanId,
} from '@/lib/company-entitlements';

describe('company entitlements', () => {
  it('defaults missing plan to standard', () => {
    expect(getCompanyPlanId(null)).toBe('standard');
    expect(getCompanyPlanId({ rfc: 'X' })).toBe('standard');
    expect(getCompanyPlanId({ plan: 'starter' })).toBe('starter');
  });

  it('denies when usage reaches starter limits', () => {
    const evaluation = evaluateEntitlement('starter', 'users', 3);

    expect(evaluation.allowed).toBe(false);
    expect(entitlementDeniedMessage(evaluation)).toContain('Starter');
  });

  it('allows enterprise unlimited metrics', () => {
    const evaluation = evaluateEntitlement('enterprise', 'users', 10_000);

    expect(evaluation.allowed).toBe(true);
  });
});
