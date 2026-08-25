import { isOAuthExpiryPast, oauthExpiresAtFromNow } from '@/lib/server/mcp-oauth/oauth-expiry';

describe('oauth expiry (timestamptz / UTC instant)', () => {
  it('expires_at from now is in the future', () => {
    const now = Date.now();
    const expires = oauthExpiresAtFromNow(60_000, now);
    expect(expires.getTime()).toBe(now + 60_000);
  });

  it('isOAuthExpiryPast uses UTC instant comparison', () => {
    const past = new Date(Date.now() - 1_000);
    const future = new Date(Date.now() + 60_000);
    expect(isOAuthExpiryPast(past)).toBe(true);
    expect(isOAuthExpiryPast(future)).toBe(false);
  });
});
