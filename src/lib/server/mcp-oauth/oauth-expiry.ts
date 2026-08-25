/** UTC instant for OAuth code/grant expiry writes (stored as timestamptz). */
export const oauthExpiresAtFromNow = (ttlMs: number, nowMs = Date.now()): Date =>
  new Date(nowMs + ttlMs);

/** True when a timestamptz expiry is in the past. */
export const isOAuthExpiryPast = (
  stored: Date,
  nowMs = Date.now(),
): boolean => stored.getTime() <= nowMs;
