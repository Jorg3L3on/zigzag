/**
 * Session lifetimes (ZIG-I17-7..8). A normal sign-in lasts 8 hours; a device the
 * person chose to remember lasts 30 days, for every role. Both renew while the
 * app is in use, so the clock counts from the last activity.
 */
export const SESSION_MAX_AGE_SECONDS = 8 * 60 * 60;
export const REMEMBERED_SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

/** Renew a normal session in its last 15 minutes; a remembered one once a day. */
export const SESSION_RENEW_WINDOW_MS = 15 * 60 * 1000;
export const REMEMBERED_SESSION_RENEW_WINDOW_MS =
  (30 - 1) * 24 * 60 * 60 * 1000;

/** Warn when a session is this close to ending and has not renewed. */
export const SESSION_EXPIRY_WARNING_MS = 5 * 60 * 1000;

export const sessionMaxAgeSeconds = (remember: boolean | null | undefined): number =>
  remember ? REMEMBERED_SESSION_MAX_AGE_SECONDS : SESSION_MAX_AGE_SECONDS;

export const sessionRenewWindowMs = (remember: boolean | null | undefined): number =>
  remember ? REMEMBERED_SESSION_RENEW_WINDOW_MS : SESSION_RENEW_WINDOW_MS;

/** True when a live session is inside its renewal window. */
export const shouldRenewSession = (
  remainingMs: number,
  remember: boolean | null | undefined,
): boolean => remainingMs > 0 && remainingMs <= sessionRenewWindowMs(remember);

/** True when the session is about to end and the person should be told. */
export const shouldWarnSessionExpiry = (remainingMs: number): boolean =>
  remainingMs > 0 && remainingMs <= SESSION_EXPIRY_WARNING_MS;
