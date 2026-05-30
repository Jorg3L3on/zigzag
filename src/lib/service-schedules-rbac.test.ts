import { AuthorizationError } from '@/lib/errors';
import { PERMISSIONS } from '@/lib/permissions';
import {
  SERVICE_SCHEDULES_READ_PERMISSION,
  SERVICE_SCHEDULES_WRITE_PERMISSIONS,
  canCreateTicketFromSchedule,
  canReadServiceSchedules,
  canWriteServiceSchedules,
  needsSelectedCompanyForSchedules,
} from '@/lib/service-schedules-rbac';
import {
  requireScheduleRead,
  requireScheduleWrite,
} from '@/lib/service-schedules-rbac-server';
import { requireActionPermission } from '@/lib/security';

jest.mock('@/lib/security', () => ({
  requireActionPermission: jest.fn(),
}));

const mockRequireActionPermission =
  requireActionPermission as jest.MockedFunction<typeof requireActionPermission>;

describe('service schedules RBAC contract', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('uses tickets.read as canonical read permission', () => {
    expect(SERVICE_SCHEDULES_READ_PERMISSION).toBe(PERMISSIONS.tickets.read);
  });

  it('allows read when user has tickets.read', () => {
    expect(
      canReadServiceSchedules(
        (permission) => permission === PERMISSIONS.tickets.read,
      ),
    ).toBe(true);
  });

  it('denies read when user lacks tickets.read', () => {
    expect(canReadServiceSchedules(() => false)).toBe(false);
  });

  it('allows write when user has tickets.write', () => {
    expect(
      canWriteServiceSchedules(
        (permission) => permission === PERMISSIONS.tickets.write,
      ),
    ).toBe(true);
  });

  it('allows write when user has clients.write', () => {
    expect(
      canWriteServiceSchedules(
        (permission) => permission === PERMISSIONS.clients.write,
      ),
    ).toBe(true);
  });

  it('denies write when user has neither write permission', () => {
    expect(canWriteServiceSchedules(() => false)).toBe(false);
  });

  it('allows ticket creation only with tickets.write', () => {
    expect(
      canCreateTicketFromSchedule(
        (permission) => permission === PERMISSIONS.tickets.write,
      ),
    ).toBe(true);
    expect(
      canCreateTicketFromSchedule(
        (permission) => permission === PERMISSIONS.clients.write,
      ),
    ).toBe(false);
  });

  it('requires selected company for system users', () => {
    expect(needsSelectedCompanyForSchedules(true, null)).toBe(true);
    expect(needsSelectedCompanyForSchedules(true, undefined)).toBe(true);
    expect(needsSelectedCompanyForSchedules(true, 0)).toBe(true);
    expect(needsSelectedCompanyForSchedules(true, 42)).toBe(false);
    expect(needsSelectedCompanyForSchedules(false, null)).toBe(false);
  });

  it('keeps exactly the expected write permissions', () => {
    expect(SERVICE_SCHEDULES_WRITE_PERMISSIONS).toEqual([
      PERMISSIONS.tickets.write,
      PERMISSIONS.clients.write,
    ]);
  });

  it('delegates read authorization to tickets.read', async () => {
    mockRequireActionPermission.mockResolvedValueOnce({
      context: {
        userId: '1',
        companyId: 10,
        companyIsSystem: false,
      },
      companyId: 10,
    });

    await expect(requireScheduleRead(10)).resolves.toEqual({
      context: {
        userId: '1',
        companyId: 10,
        companyIsSystem: false,
      },
      companyId: 10,
    });

    expect(mockRequireActionPermission).toHaveBeenCalledWith(
      PERMISSIONS.tickets.read,
      10,
    );
  });

  it('uses tickets.write first for schedule writes', async () => {
    mockRequireActionPermission.mockResolvedValueOnce({
      context: {
        userId: '1',
        companyId: 10,
        companyIsSystem: false,
      },
      companyId: 10,
    });

    await expect(requireScheduleWrite(10)).resolves.toEqual({
      context: {
        userId: '1',
        companyId: 10,
        companyIsSystem: false,
      },
      companyId: 10,
    });

    expect(mockRequireActionPermission).toHaveBeenCalledTimes(1);
    expect(mockRequireActionPermission).toHaveBeenCalledWith(
      PERMISSIONS.tickets.write,
      10,
    );
  });

  it('falls back to clients.write when tickets.write is denied', async () => {
    mockRequireActionPermission
      .mockRejectedValueOnce(new AuthorizationError('Missing permission'))
      .mockResolvedValueOnce({
        context: {
          userId: '2',
          companyId: 11,
          companyIsSystem: false,
        },
        companyId: 11,
      });

    await expect(requireScheduleWrite(11)).resolves.toEqual({
      context: {
        userId: '2',
        companyId: 11,
        companyIsSystem: false,
      },
      companyId: 11,
    });

    expect(mockRequireActionPermission).toHaveBeenNthCalledWith(
      1,
      PERMISSIONS.tickets.write,
      11,
    );
    expect(mockRequireActionPermission).toHaveBeenNthCalledWith(
      2,
      PERMISSIONS.clients.write,
      11,
    );
  });
});
