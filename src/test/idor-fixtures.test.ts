import {
  buildIdorActionContext,
  buildIdorSession,
  buildIdorSystemActionContext,
  buildIdorSystemSession,
  CROSS_TENANT_DENIAL_STATUSES,
  IDOR_COMPANY_A,
  IDOR_COMPANY_B,
  IDOR_RESOURCES_A,
  IDOR_SYSTEM_COMPANY,
  isCrossTenantDenialStatus,
  mockApiPermissionAllowed,
  mockApiPermissionCrossTenantDenied,
} from '@/test/idor-fixtures';
import { resolveWritableCompanyId } from '@/lib/authz-context';
import { AuthorizationError } from '@/lib/errors';

describe('IDOR test fixtures', () => {
  it('builds distinct tenant sessions for Company A and B', () => {
    const sessionA = buildIdorSession(IDOR_COMPANY_A, '10');
    const sessionB = buildIdorSession(IDOR_COMPANY_B, '20');

    expect(sessionA.user.company_id).toBe(IDOR_COMPANY_A.id);
    expect(sessionB.user.company_id).toBe(IDOR_COMPANY_B.id);
    expect(sessionA.user.company_is_system).toBe(false);
    expect(sessionB.user.company_is_system).toBe(false);
  });

  it('builds a system company session', () => {
    const session = buildIdorSystemSession();
    expect(session.user.company_id).toBe(IDOR_SYSTEM_COMPANY.id);
    expect(session.user.company_is_system).toBe(true);
  });

  it('maps action contexts to authz helpers', () => {
    const tenantA = buildIdorActionContext(IDOR_COMPANY_A);
    expect(resolveWritableCompanyId(tenantA)).toBe(IDOR_COMPANY_A.id);
    expect(() =>
      resolveWritableCompanyId(tenantA, IDOR_COMPANY_B.id),
    ).toThrow(AuthorizationError);

    const system = buildIdorSystemActionContext();
    expect(resolveWritableCompanyId(system, IDOR_COMPANY_B.id)).toBe(
      IDOR_COMPANY_B.id,
    );
  });

  it('exposes Company A resource IDs for cross-tenant scenarios', () => {
    expect(IDOR_RESOURCES_A.companyId).toBe(IDOR_COMPANY_A.id);
    expect(IDOR_RESOURCES_A.clientId).toBeGreaterThan(0);
  });

  it('provides API permission mocks for allowed and denied cases', () => {
    const session = buildIdorSession(IDOR_COMPANY_B);
    const allowed = mockApiPermissionAllowed(session, IDOR_COMPANY_B.id);
    expect(allowed.unauthorized).toBeNull();
    expect(allowed.companyId).toBe(IDOR_COMPANY_B.id);

    const denied = mockApiPermissionCrossTenantDenied();
    expect(denied.unauthorized?.status).toBe(403);
  });

  it('recognizes cross-tenant denial HTTP statuses', () => {
    expect(CROSS_TENANT_DENIAL_STATUSES).toEqual([403, 404]);
    expect(isCrossTenantDenialStatus(403)).toBe(true);
    expect(isCrossTenantDenialStatus(404)).toBe(true);
    expect(isCrossTenantDenialStatus(200)).toBe(false);
  });
});
