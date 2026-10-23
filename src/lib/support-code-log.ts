/**
 * Record a support code without showing it. Client-safe: the structured logger
 * imports `node:async_hooks` and cannot be bundled for the browser (ZIG-24).
 */
export const logSupportCode = (code: string | null | undefined): void => {
  if (!code) return;
  console.warn('support error code', code);
};
