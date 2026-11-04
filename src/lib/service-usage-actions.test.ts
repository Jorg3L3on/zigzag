import { getServiceUsage } from '@/actions/service-usage';
import { db } from '@/lib/db';
import { requireTenantActionPermission } from '@/lib/security';
import {
  IDOR_COMPANY_A,
  IDOR_COMPANY_B,
  IDOR_RESOURCES_A,
  mockActionAuthorized,
  mockActionCrossTenantDenied,
} from '@/test/cross-tenant-action-helpers';

jest.mock('@/lib/db', () => ({
  db: { select: jest.fn() },
}));

jest.mock('@/lib/security', () => ({
  requireTenantActionPermission: jest.fn(),
}));

const mockRequireTenantActionPermission =
  requireTenantActionPermission as jest.MockedFunction<
    typeof requireTenantActionPermission
  >;
const mockDb = db as unknown as { select: jest.Mock };

const mockCount = (total: number) => {
  const where = jest.fn().mockResolvedValue([{ total }]);
  const innerJoin = jest.fn(() => ({ where }));
  const from = jest.fn(() => ({ innerJoin }));
  return { from, where };
};

describe('cross-tenant IDOR — getServiceUsage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('denies another company context without querying', async () => {
    mockActionCrossTenantDenied(mockRequireTenantActionPermission);

    const result = await getServiceUsage(IDOR_RESOURCES_A.serviceId, IDOR_COMPANY_A.id);

    expect(result.success).toBe(false);
    expect(mockDb.select).not.toHaveBeenCalled();
  });

  it('counts only inside the caller company', async () => {
    mockActionAuthorized(mockRequireTenantActionPermission, IDOR_COMPANY_B.id);
    const tickets = mockCount(0);
    const presupuestos = mockCount(0);
    mockDb.select
      .mockReturnValueOnce({ from: tickets.from })
      .mockReturnValueOnce({ from: presupuestos.from });

    const result = await getServiceUsage(IDOR_RESOURCES_A.serviceId);

    expect(mockRequireTenantActionPermission).toHaveBeenCalledWith(
      'services.write',
      undefined,
    );
    expect(result).toEqual({
      success: true,
      data: { openTickets: 0, openPresupuestos: 0 },
    });
  });
});
