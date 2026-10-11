import { describe, expect, it } from '@jest/globals';
import {
  REMEMBERED_SESSION_MAX_AGE_SECONDS,
  SESSION_MAX_AGE_SECONDS,
  sessionMaxAgeSeconds,
  shouldRenewSession,
  shouldWarnSessionExpiry,
} from '@/lib/session-policy';

const MIN = 60 * 1000;
const DAY = 24 * 60 * MIN;

describe('session policy (ZIG-I17-7..8)', () => {
  it('lasts 8 hours normally and 30 days on a remembered device', () => {
    expect(sessionMaxAgeSeconds(false)).toBe(SESSION_MAX_AGE_SECONDS);
    expect(sessionMaxAgeSeconds(undefined)).toBe(8 * 60 * 60);
    expect(sessionMaxAgeSeconds(true)).toBe(REMEMBERED_SESSION_MAX_AGE_SECONDS);
    expect(REMEMBERED_SESSION_MAX_AGE_SECONDS).toBe(30 * 24 * 60 * 60);
  });

  it('renews a normal session only in its last 15 minutes', () => {
    expect(shouldRenewSession(7 * 60 * MIN, false)).toBe(false);
    expect(shouldRenewSession(14 * MIN, false)).toBe(true);
    expect(shouldRenewSession(0, false)).toBe(false);
  });

  it('renews a remembered session once a day so it slides to 30 days from last use', () => {
    expect(shouldRenewSession(29.5 * DAY, true)).toBe(false);
    expect(shouldRenewSession(28 * DAY, true)).toBe(true);
    expect(shouldRenewSession(-1, true)).toBe(false);
  });

  it('warns in the last five minutes of a live session', () => {
    expect(shouldWarnSessionExpiry(6 * MIN)).toBe(false);
    expect(shouldWarnSessionExpiry(4 * MIN)).toBe(true);
    expect(shouldWarnSessionExpiry(0)).toBe(false);
  });
});
