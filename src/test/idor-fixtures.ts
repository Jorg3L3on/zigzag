import type { ActionAuthContext } from '@/lib/authz-context';
import type { Session } from 'next-auth';

/** Fixture tenants for cross-tenant IDOR tests. */
export const IDOR_COMPANY_A = { id: 10, name: 'IDOR Company A' } as const;
export const IDOR_COMPANY_B = { id: 20, name: 'IDOR Company B' } as const;
export const IDOR_SYSTEM_COMPANY = { id: 1, name: 'IDOR System Co' } as const;

/** Resource IDs owned by Company A — use when asserting Company B denial. */
export const IDOR_RESOURCES_A = {
  clientId: 1001,
  serviceId: 2001,
  ticketId: 3001,
  userId: '4001',
  roleId: 5001,
  permissionId: 6001,
  scheduleId: 7001,
  notificationId: 8001,
  companyId: IDOR_COMPANY_A.id,
} as const;

export type IdorSessionUser = Session['user'];

export const buildIdorSession = (
  company: typeof IDOR_COMPANY_A | typeof IDOR_COMPANY_B,
  userId = '101',
): Session =>
  ({
    user: {
      id: userId,
      company_id: company.id,
      company_name: company.name,
      company_is_system: false,
    },
    expires: new Date(Date.now() + 60_000).toISOString(),
  }) as Session;

export const buildIdorSystemSession = (userId = '1'): Session =>
  ({
    user: {
      id: userId,
      company_id: IDOR_SYSTEM_COMPANY.id,
      company_name: IDOR_SYSTEM_COMPANY.name,
      company_is_system: true,
    },
    expires: new Date(Date.now() + 60_000).toISOString(),
  }) as Session;

export const buildIdorActionContext = (
  company: typeof IDOR_COMPANY_A | typeof IDOR_COMPANY_B,
  userId = '101',
): ActionAuthContext => ({
  userId,
  companyId: company.id,
  companyIsSystem: false,
});

export const buildIdorSystemActionContext = (userId = '1'): ActionAuthContext => ({
  userId,
  companyId: IDOR_SYSTEM_COMPANY.id,
  companyIsSystem: true,
});

export type ApiPermissionResult = {
  session: Session | null;
  companyId: number | null;
  unauthorized: { status: number; body?: unknown } | null;
};

/** Authorized tenant API permission mock for the user's own company. */
export const mockApiPermissionAllowed = (
  session: Session,
  companyId: number,
): ApiPermissionResult => ({
  session,
  companyId,
  unauthorized: null,
});

/** Cross-tenant company context denial (403). */
export const mockApiPermissionCrossTenantDenied = (): ApiPermissionResult => ({
  session: null,
  companyId: null,
  unauthorized: {
    status: 403,
    body: { success: false, error: 'AU002', errorType: 'auth' },
  },
});

/** HTTP statuses that indicate cross-tenant access was denied. */
export const CROSS_TENANT_DENIAL_STATUSES = [403, 404] as const;

export const isCrossTenantDenialStatus = (status: number): boolean =>
  (CROSS_TENANT_DENIAL_STATUSES as readonly number[]).includes(status);
