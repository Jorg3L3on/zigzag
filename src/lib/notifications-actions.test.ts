import {
  getNotifications,
  getUnreadNotificationCount,
  markAllNotificationsRead,
  markNotificationRead,
} from '@/actions/notifications';
import { db } from '@/lib/db';
import { materializeScheduleNotificationsForCompany } from '@/lib/notifications';
import { requireActionAuth } from '@/lib/security';
import { IDOR_COMPANY_B, tenantBContext } from '@/test/cross-tenant-action-helpers';

jest.mock('@/lib/db', () => ({
  db: {
    select: jest.fn(),
    update: jest.fn(),
  },
}));

jest.mock('@/lib/security', () => ({
  requireActionAuth: jest.fn(),
}));

jest.mock('@/lib/notifications', () => ({
  materializeScheduleNotificationsForCompany: jest.fn(),
}));

const mockRequireActionAuth = requireActionAuth as jest.MockedFunction<
  typeof requireActionAuth
>;
const mockMaterializeScheduleNotificationsForCompany =
  materializeScheduleNotificationsForCompany as jest.MockedFunction<
    typeof materializeScheduleNotificationsForCompany
  >;
const mockDb = db as unknown as { select: jest.Mock; update: jest.Mock };

const mockSelectRows = (rows: unknown[]) => {
  const limit = jest.fn(async () => rows);
  const orderBy = jest.fn(() => ({ limit }));
  const where = jest.fn(() => ({ orderBy }));
  const from = jest.fn(() => ({ where }));
  mockDb.select.mockReturnValue({ from });
};

const mockSelectCount = (total: number) => {
  const where = jest.fn(async () => [{ total }]);
  const from = jest.fn(() => ({ where }));
  mockDb.select.mockReturnValue({ from });
};

const mockUpdateChain = () => {
  const where = jest.fn(async () => []);
  const set = jest.fn(() => ({ where }));
  mockDb.update.mockReturnValue({ set });
};

describe('cross-tenant IDOR - notifications actions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('getNotifications scopes list generation to authenticated tenant', async () => {
    mockRequireActionAuth.mockResolvedValue(tenantBContext());
    mockMaterializeScheduleNotificationsForCompany.mockResolvedValue(undefined);
    mockSelectRows([]);

    const result = await getNotifications();

    expect(result.success).toBe(true);
    expect(result.data).toEqual([]);
    expect(mockMaterializeScheduleNotificationsForCompany).toHaveBeenCalledWith(
      IDOR_COMPANY_B.id,
    );
    expect(mockDb.select).toHaveBeenCalledTimes(1);
  });

  it('getUnreadNotificationCount short-circuits when company scope is missing', async () => {
    mockRequireActionAuth.mockResolvedValue({
      userId: '201',
      companyId: null,
      companyIsSystem: false,
    });

    const result = await getUnreadNotificationCount();

    expect(result).toEqual({ success: true, data: 0 });
    expect(mockDb.select).not.toHaveBeenCalled();
  });

  it('does not write notification state without company context', async () => {
    mockRequireActionAuth.mockResolvedValue({
      userId: '201',
      companyId: null,
      companyIsSystem: false,
    });

    const singleResult = await markNotificationRead(1);
    const allResult = await markAllNotificationsRead();

    expect(singleResult).toEqual({ success: false, errorType: 'auth' });
    expect(allResult).toEqual({ success: false, errorType: 'auth' });
    expect(mockDb.update).not.toHaveBeenCalled();
  });

  it('applies read updates through tenant-scoped visibility filter', async () => {
    mockRequireActionAuth.mockResolvedValue(tenantBContext());
    mockSelectCount(2);
    mockUpdateChain();

    const countResult = await getUnreadNotificationCount();
    const markResult = await markNotificationRead(42);

    expect(countResult).toEqual({ success: true, data: 2 });
    expect(markResult).toEqual({ success: true });
    expect(mockDb.update).toHaveBeenCalledTimes(1);
  });
});
