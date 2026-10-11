/** @jest-environment node */
import { describe, expect, it } from '@jest/globals';
import { decode, encode } from 'next-auth/jwt';
import { sessionMaxAgeSeconds } from '@/lib/session-policy';

const secret = 'test-secret-test-secret-test-secret';
const salt = 'zigzag.session-token';
const DAY = 24 * 60 * 60;

const issue = async (remember: boolean, issuedAgoSeconds: number) => {
  const now = Math.floor(Date.now() / 1000) - issuedAgoSeconds;
  const realNow = Date.now;
  Date.now = () => now * 1000;
  try {
    return await encode({
      token: { sub: '1', remember },
      secret,
      salt,
      maxAge: sessionMaxAgeSeconds(remember),
    });
  } finally {
    Date.now = realNow;
  }
};

const stillValid = async (jwt: string) => {
  try {
    return (await decode({ token: jwt, secret, salt })) != null;
  } catch {
    return false;
  }
};

describe('session token lifetime (ZIG-I17-7)', () => {
  it('lasts 8 hours normally and 30 days when remembered', async () => {
    const normal = await decode({ token: await issue(false, 0), secret, salt });
    const remembered = await decode({ token: await issue(true, 0), secret, salt });
    expect(Number(normal?.exp) - Number(normal?.iat)).toBe(8 * 60 * 60);
    expect(Number(remembered?.exp) - Number(remembered?.iat)).toBe(30 * DAY);
  });

  it('a remembered device still works on day 29 and is rejected on day 31', async () => {
    expect(await stillValid(await issue(true, 29 * DAY))).toBe(true);
    expect(await stillValid(await issue(true, 31 * DAY))).toBe(false);
  });

  it('a normal sign-in is rejected after a day', async () => {
    expect(await stillValid(await issue(false, DAY))).toBe(false);
  });
});
