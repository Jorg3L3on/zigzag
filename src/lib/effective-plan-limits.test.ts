import { resolveEffectiveLimits } from '@/lib/effective-plan-limits';
import { getPlanLimits } from '@/lib/company-entitlements';

describe('resolveEffectiveLimits', () => {
  it('returns plan limits when no overrides are set', () => {
    expect(resolveEffectiveLimits(getPlanLimits('starter'), null)).toEqual({
      users: 3,
      clients: 25,
      services: 25,
      tickets_month: 50,
    });
  });

  it('merges partial overrides on top of plan limits', () => {
    expect(
      resolveEffectiveLimits(getPlanLimits('standard'), { users: 25 }),
    ).toEqual({
      users: 25,
      clients: 200,
      services: 200,
      tickets_month: 500,
    });
  });

  it('treats override null as unlimited for that metric', () => {
    expect(
      resolveEffectiveLimits(getPlanLimits('starter'), { users: null }),
    ).toEqual({
      users: null,
      clients: 25,
      services: 25,
      tickets_month: 50,
    });
  });

  it('returns all-null limits for enterprise plans', () => {
    expect(resolveEffectiveLimits(getPlanLimits('enterprise'), null)).toEqual({
      users: null,
      clients: null,
      services: null,
      tickets_month: null,
    });
  });

  it('falls back to standard limits when plan limits are missing', () => {
    expect(resolveEffectiveLimits(null, null)).toEqual(getPlanLimits('standard'));
  });
});
