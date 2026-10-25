/**
 * The desktop sidebar's open/collapsed cookie. Lives outside the "use client"
 * sidebar module so the (app) layout can read it on the server (ZIG-I26-3).
 */
export const SIDEBAR_COOKIE_NAME = 'sidebar_state';

/** Open unless the cookie says it was collapsed; no cookie means open. */
export const isSidebarOpenFromCookie = (value: string | undefined): boolean =>
  value !== 'false';
