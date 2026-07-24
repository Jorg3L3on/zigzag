import { AsyncLocalStorage } from 'node:async_hooks';

/** Canonical header for request correlation (lowercase; HTTP is case-insensitive). */
export const REQUEST_ID_HEADER = 'x-request-id';

/**
 * Allow opaque client/proxy ids (UUIDs, ulids, Cloudflare ray-style) while
 * rejecting empty or absurdly long values that would bloat logs.
 */
const REQUEST_ID_PATTERN = /^[\w.:-]{8,128}$/;

type RequestStore = {
  requestId: string;
};

const storage = new AsyncLocalStorage<RequestStore>();

/** Generate a correlation/request id for tracing a single operation. */
export const correlationId = (): string => {
  try {
    return crypto.randomUUID();
  } catch {
    return `req_${Date.now().toString(36)}_${Math.random()
      .toString(36)
      .slice(2, 10)}`;
  }
};

export const normalizeRequestId = (
  value: string | null | undefined,
): string | null => {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  if (!REQUEST_ID_PATTERN.test(trimmed)) {
    return null;
  }
  return trimmed;
};

/** Prefer a valid incoming id; otherwise mint a new one. */
export const resolveRequestId = (incoming?: string | null): string =>
  normalizeRequestId(incoming) ?? correlationId();

export const getRequestId = (): string | undefined =>
  storage.getStore()?.requestId;

/**
 * Bind `requestId` for the remainder of the current async request context.
 * Uses `enterWith` so auth helpers can attach context without wrapping callers.
 */
export const bindRequestId = (requestId: string): string => {
  storage.enterWith({ requestId });
  return requestId;
};

export const runWithRequestId = <T>(requestId: string, fn: () => T): T =>
  storage.run({ requestId }, fn);

export const runWithRequestIdAsync = <T>(
  requestId: string,
  fn: () => Promise<T>,
): Promise<T> => storage.run({ requestId }, fn);

/** Bind from an incoming Fetch/Next request (API routes, cron, health). */
export const bindRequestIdFromRequest = (request: Request): string => {
  const requestId = resolveRequestId(request.headers.get(REQUEST_ID_HEADER));
  return bindRequestId(requestId);
};

/**
 * Bind from Next.js request headers (Server Actions / RSC). Safe no-op mint
 * when `headers()` is unavailable (unit tests, scripts).
 */
export const bindRequestContextFromHeaders = async (): Promise<string> => {
  let incoming: string | null = null;
  try {
    const { headers } = await import('next/headers');
    const headerStore = await headers();
    incoming = headerStore.get(REQUEST_ID_HEADER);
  } catch {
    // Outside a request scope (Jest, CLI) — mint a local id.
  }
  return bindRequestId(resolveRequestId(incoming));
};
