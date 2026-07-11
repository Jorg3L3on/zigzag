import {
  entitlementDeniedMessage,
  evaluateEntitlement,
} from '@/lib/company-entitlements';

describe('company entitlements', () => {
  it('denies when usage reaches starter limits', () => {
    const evaluation = evaluateEntitlement(
      { users: 3, clients: 25, services: 25, tickets_month: 50 },
      'starter',
      'users',
      3,
    );

    expect(evaluation.allowed).toBe(false);
    expect(entitlementDeniedMessage(evaluation)).toContain('Starter');
  });

  it('allows enterprise unlimited metrics', () => {
    const evaluation = evaluateEntitlement(
      {
        users: null,
        clients: null,
        services: null,
        tickets_month: null,
      },
      'enterprise',
      'users',
      10_000,
    );

    expect(evaluation.allowed).toBe(true);
  });
});
