'use client';

/**
 * Asks the server whether this phone still has a session, and for which company
 * (ZIG-I36-20, ZIG-I36-21). A Server Action sent with a dead session does not
 * fail like a network error: the proxy redirects it to /login and the browser
 * throws. Without this check that looks exactly like "no signal".
 *
 * `/api/auth/session` is network-only in the service worker, so the answer is
 * never a cached one.
 */
export type SessionProbe =
  | { status: 'active'; companyId: number | null; companyIsSystem: boolean }
  | { status: 'expired' }
  | { status: 'unreachable' };

export const probeSession = async (
  fetchImpl: typeof fetch | undefined = typeof fetch !== 'undefined' ? fetch : undefined,
): Promise<SessionProbe> => {
  if (!fetchImpl) return { status: 'unreachable' };
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return { status: 'unreachable' };
  }
  try {
    const response = await fetchImpl('/api/auth/session', {
      cache: 'no-store',
      credentials: 'same-origin',
    });
    if (!response.ok) return { status: 'unreachable' };
    const body = (await response.json()) as {
      user?: { company_id?: number; company_is_system?: boolean };
    } | null;
    if (!body?.user) return { status: 'expired' };
    return {
      status: 'active',
      companyId: typeof body.user.company_id === 'number' ? body.user.company_id : null,
      companyIsSystem: Boolean(body.user.company_is_system),
    };
  } catch {
    return { status: 'unreachable' };
  }
};

/** Whether this session may upload what company `companyId` saved on the phone. */
export const sessionMayUploadFor = (probe: SessionProbe, companyId: number): boolean => {
  if (probe.status === 'expired') return false;
  if (probe.status === 'unreachable') return true;
  // Operators act on tenants they pick; everyone else only on their own company.
  return probe.companyIsSystem || probe.companyId === companyId;
};
