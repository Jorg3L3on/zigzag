import { probeSession, sessionMayUploadFor, type SessionProbe } from '@/lib/session-probe';

const respond = (body: unknown, ok = true) =>
  (async () => ({ ok, json: async () => body })) as unknown as typeof fetch;

describe('probeSession', () => {
  it('reads the company of an active session', async () => {
    const probe = await probeSession(
      respond({ user: { company_id: 7, company_is_system: false } }),
    );
    expect(probe).toEqual({ status: 'active', companyId: 7, companyIsSystem: false });
  });

  it('calls a null session expired', async () => {
    expect(await probeSession(respond(null))).toEqual({ status: 'expired' });
  });

  it('does not call a failed request expired', async () => {
    expect(await probeSession(respond(null, false))).toEqual({ status: 'unreachable' });
    const failing = (async () => {
      throw new TypeError('Failed to fetch');
    }) as unknown as typeof fetch;
    expect(await probeSession(failing)).toEqual({ status: 'unreachable' });
  });
});

describe('sessionMayUploadFor', () => {
  const active = (companyId: number, companyIsSystem = false): SessionProbe => ({
    status: 'active',
    companyId,
    companyIsSystem,
  });

  it('uploads only for the session company', () => {
    expect(sessionMayUploadFor(active(1), 1)).toBe(true);
    expect(sessionMayUploadFor(active(2), 1)).toBe(false);
  });

  it('lets an operator upload for the tenant they picked', () => {
    expect(sessionMayUploadFor(active(99, true), 1)).toBe(true);
  });

  it('never uploads with a closed session, and keeps trying when the server is unreachable', () => {
    expect(sessionMayUploadFor({ status: 'expired' }, 1)).toBe(false);
    expect(sessionMayUploadFor({ status: 'unreachable' }, 1)).toBe(true);
  });
});
