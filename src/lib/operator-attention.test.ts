import { resolveOperatorAttention } from '@/lib/operator-attention';

const now = new Date('2026-11-11T12:00:00.000Z');
const daysAgo = (days: number) =>
  new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();

describe('resolveOperatorAttention (ZIG-I38)', () => {
  it('says nothing for an active, complete, recently used company', () => {
    expect(
      resolveOperatorAttention({
        lifecycle: 'ACTIVE', profileMissing: 0, alert: null, lastSignInAt: daysAgo(1), now,
      }),
    ).toEqual([]);
  });

  it('flags missing profile data', () => {
    expect(
      resolveOperatorAttention({
        lifecycle: 'SETUP', profileMissing: 2, alert: null, lastSignInAt: null, now,
      }).map((reason) => reason.label),
    ).toEqual(['Faltan 2 datos']);
  });

  it('flags a setup company with a complete profile as ready to activate', () => {
    expect(
      resolveOperatorAttention({
        lifecycle: 'SETUP', profileMissing: 0, alert: null, lastSignInAt: null, now,
      }).map((reason) => reason.id),
    ).toEqual(['ready_to_activate']);
  });

  it('flags an active company nobody used in 14 days', () => {
    expect(
      resolveOperatorAttention({
        lifecycle: 'ACTIVE', profileMissing: 0, alert: null, lastSignInAt: daysAgo(16), now,
      }).map((reason) => reason.id),
    ).toEqual(['unused']);
  });

  it('does not flag a company created this week as unused', () => {
    expect(
      resolveOperatorAttention({
        lifecycle: 'ACTIVE', profileMissing: 0, alert: null, lastSignInAt: null,
        createdAt: daysAgo(3), now,
      }),
    ).toEqual([]);
  });

  it('never flags suspended (complete) or archived companies for pending data', () => {
    expect(
      resolveOperatorAttention({
        lifecycle: 'SUSPENDED', profileMissing: 0, alert: null, lastSignInAt: null, now,
      }),
    ).toEqual([]);
    expect(
      resolveOperatorAttention({
        lifecycle: 'ARCHIVED', profileMissing: 3, alert: null, lastSignInAt: null, now,
      }),
    ).toEqual([]);
  });

  it('puts the security alert first', () => {
    const reasons = resolveOperatorAttention({
      lifecycle: 'ACTIVE',
      profileMissing: 1,
      alert: { kind: 'sign_in_burst', at: daysAgo(0), account: 'a@x.test', count: 6, label: '6 inicios fallidos en 15 min' },
      lastSignInAt: daysAgo(1),
      now,
    });
    expect(reasons.map((reason) => reason.id)).toEqual(['alert', 'missing_profile']);
  });
});
