import {
  buildOperatorSecurityAlert,
  detectSignInBurst,
} from '@/lib/operator-sign-in-burst';

const at = (minute: number) => new Date(Date.UTC(2026, 10, 11, 9, minute));
const fails = (account: string, minutes: number[]) =>
  minutes.map((minute) => ({ account, occurredAt: at(minute) }));

describe('sign-in burst rule (ZIG-I38 E12)', () => {
  it('does not alert on a single failed sign-in', () => {
    expect(detectSignInBurst(fails('a@x.test', [5]))).toBeNull();
  });

  it('does not alert on 4 failures in 15 minutes', () => {
    expect(detectSignInBurst(fails('a@x.test', [0, 3, 6, 9]))).toBeNull();
  });

  it('alerts on 5 failures of one account within 15 minutes', () => {
    expect(detectSignInBurst(fails('a@x.test', [5, 6, 6, 8, 10, 11, 12]))).toEqual({
      account: 'a@x.test',
      at: at(12),
      count: 7,
    });
  });

  it('does not add failures of different accounts together', () => {
    expect(
      detectSignInBurst([
        ...fails('a@x.test', [0, 1, 2]),
        ...fails('b@x.test', [0, 1, 2]),
      ]),
    ).toBeNull();
  });

  it('does not alert when 5 failures are spread over more than 15 minutes', () => {
    expect(detectSignInBurst(fails('a@x.test', [0, 5, 10, 15, 21]))).toBeNull();
  });

  it('builds an alert only inside the 7-day window', () => {
    const burst = { account: 'a@x.test', at: at(12), count: 5 };
    const now = new Date(at(12).getTime() + 8 * 24 * 60 * 60 * 1000);
    expect(buildOperatorSecurityAlert({ burst, permissionDenied: null, now })).toBeNull();
    expect(
      buildOperatorSecurityAlert({ burst, permissionDenied: null, now: at(30) }),
    ).toMatchObject({ kind: 'sign_in_burst', count: 5, account: 'a@x.test' });
  });

  it('raises permission denied as an alert', () => {
    expect(
      buildOperatorSecurityAlert({
        burst: null,
        permissionDenied: { at: at(1), account: null, count: 2 },
        now: at(30),
      }),
    ).toMatchObject({ kind: 'permission_denied', label: '2 permisos denegados' });
  });
});
