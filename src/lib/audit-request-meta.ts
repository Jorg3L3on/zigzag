import {
  REQUEST_ID_HEADER,
  getRequestId,
  normalizeRequestId,
} from '@/lib/request-context';

export type AuditRequestMetaFields = {
  ip?: string | null;
  userAgent?: string | null;
  route?: string | null;
  method?: string | null;
  requestId?: string | null;
};

const asTrimmed = (value: string | null | undefined): string | null => {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const readHeader = (
  headers: Headers | { get: (name: string) => string | null },
  name: string,
): string | null => asTrimmed(headers.get(name));

/** Extract client IP from common proxy / platform headers. */
export const getClientIpFromHeaders = (
  headers: Headers | { get: (name: string) => string | null },
): string | null => {
  const forwarded = readHeader(headers, 'x-forwarded-for');
  if (forwarded) {
    return asTrimmed(forwarded.split(',')[0] ?? null);
  }
  return (
    readHeader(headers, 'x-real-ip') ||
    readHeader(headers, 'cf-connecting-ip') ||
    null
  );
};

/**
 * Build a compact `request_meta` object for audit rows.
 * Omits empty fields; returns `undefined` when nothing useful is present.
 */
export const buildAuditRequestMeta = (
  input: AuditRequestMetaFields,
): Record<string, string> | undefined => {
  const meta: Record<string, string> = {};
  const ip = asTrimmed(input.ip);
  const userAgent = asTrimmed(input.userAgent);
  const route = asTrimmed(input.route);
  const method = asTrimmed(input.method)?.toUpperCase() ?? null;
  const requestId =
    normalizeRequestId(input.requestId) ?? asTrimmed(input.requestId);

  if (ip) {
    meta.ip = ip;
  }
  if (userAgent) {
    meta.userAgent = userAgent;
  }
  if (route) {
    meta.route = route;
  }
  if (method) {
    meta.method = method;
  }
  if (requestId) {
    meta.requestId = requestId;
  }

  return Object.keys(meta).length > 0 ? meta : undefined;
};

export const buildAuditRequestMetaFromRequest = (
  request: Request | { headers: Headers; url?: string; method?: string },
): Record<string, string> | undefined => {
  const headers = request.headers;
  let route: string | null = null;
  if ('url' in request && typeof request.url === 'string' && request.url) {
    try {
      route = new URL(request.url).pathname;
    } catch {
      route = null;
    }
  }

  return buildAuditRequestMeta({
    ip: getClientIpFromHeaders(headers),
    userAgent: readHeader(headers, 'user-agent'),
    route,
    method:
      'method' in request && typeof request.method === 'string'
        ? request.method
        : null,
    requestId:
      normalizeRequestId(readHeader(headers, REQUEST_ID_HEADER)) ??
      getRequestId() ??
      null,
  });
};

/**
 * Best-effort meta from Next.js `headers()` + ALS request id.
 * Safe outside a request scope (returns requestId-only or undefined).
 */
export const buildAuditRequestMetaFromHeaders = async (
  extras: Omit<AuditRequestMetaFields, 'ip' | 'userAgent' | 'requestId'> = {},
): Promise<Record<string, string> | undefined> => {
  let ip: string | null = null;
  let userAgent: string | null = null;
  let headerRequestId: string | null = null;

  try {
    const { headers } = await import('next/headers');
    const headerStore = await headers();
    ip = getClientIpFromHeaders(headerStore);
    userAgent = readHeader(headerStore, 'user-agent');
    headerRequestId = normalizeRequestId(
      readHeader(headerStore, REQUEST_ID_HEADER),
    );
  } catch {
    // Jest / scripts — fall through with ALS id only.
  }

  return buildAuditRequestMeta({
    ip,
    userAgent,
    route: extras.route,
    method: extras.method,
    requestId: headerRequestId ?? getRequestId() ?? null,
  });
};

/** Merge caller-provided meta over auto-detected fields (caller wins). */
export const mergeAuditRequestMeta = (
  ...parts: Array<Record<string, unknown> | null | undefined>
): Record<string, unknown> | undefined => {
  const merged: Record<string, unknown> = {};
  for (const part of parts) {
    if (!part) {
      continue;
    }
    for (const [key, value] of Object.entries(part)) {
      if (value == null) {
        continue;
      }
      if (typeof value === 'string' && value.trim() === '') {
        continue;
      }
      merged[key] = value;
    }
  }
  return Object.keys(merged).length > 0 ? merged : undefined;
};
