import {
  deleteClientServiceSchedule,
  listClientServiceSchedules,
  pauseClientServiceSchedule,
  resumeClientServiceSchedule,
  upsertClientServiceSchedule,
} from '@/actions/client-service-schedules';
import { db } from '@/lib/db';
import { AuthorizationError } from '@/lib/errors';
import {
  requireScheduleRead,
  requireScheduleWrite,
} from '@/lib/service-schedules-rbac-server';
import { IDOR_COMPANY_A, IDOR_RESOURCES_A } from '@/test/cross-tenant-action-helpers';

jest.mock('@/lib/db', () => ({
  db: {
    query: {
      clientServiceSchedule: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
      },
    },
    insert: jest.fn(),
    update: jest.fn(),
  },
}));

jest.mock('@/lib/service-schedules-rbac-server', () => ({
  requireScheduleRead: jest.fn(),
  requireScheduleWrite: jest.fn(),
}));

jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }));

const mockRequireScheduleRead = requireScheduleRead as jest.MockedFunction<
  typeof requireScheduleRead
>;
const mockRequireScheduleWrite = requireScheduleWrite as jest.MockedFunction<
  typeof requireScheduleWrite
>;
const mockDb = db as unknown as {
  query: {
    clientServiceSchedule: {
      findMany: jest.Mock;
      findFirst: jest.Mock;
    };
  };
  insert: jest.Mock;
  update: jest.Mock;
};

describe('cross-tenant IDOR - client service schedule actions', () => {
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('listClientServiceSchedules denies cross-tenant company context', async () => {
    mockRequireScheduleRead.mockRejectedValue(
      new AuthorizationError('Access denied to requested company'),
    );

    const result = await listClientServiceSchedules({
      companyId: IDOR_COMPANY_A.id,
    });

    expect(result.success).toBe(false);
    expect(result.errorType).toBe('auth');
    expect(mockDb.query.clientServiceSchedule.findMany).not.toHaveBeenCalled();
  });

  it.each([
    [
      'upsertClientServiceSchedule',
      () =>
        upsertClientServiceSchedule({
          clientId: IDOR_RESOURCES_A.clientId,
          serviceId: IDOR_RESOURCES_A.serviceId,
          intervalValue: 1,
          intervalUnit: 'month',
          lastServiceAt: new Date('2026-01-01T00:00:00.000Z'),
          companyId: IDOR_COMPANY_A.id,
        }),
    ],
    [
      'pauseClientServiceSchedule',
      () =>
        pauseClientServiceSchedule(
          IDOR_RESOURCES_A.scheduleId,
          'Cross-tenant attempt',
          IDOR_COMPANY_A.id,
        ),
    ],
    [
      'resumeClientServiceSchedule',
      () =>
        resumeClientServiceSchedule(
          IDOR_RESOURCES_A.scheduleId,
          IDOR_COMPANY_A.id,
        ),
    ],
    [
      'deleteClientServiceSchedule',
      () =>
        deleteClientServiceSchedule(
          IDOR_RESOURCES_A.scheduleId,
          IDOR_COMPANY_A.id,
        ),
    ],
  ])('%s denies cross-tenant company context', async (_name, call) => {
    mockRequireScheduleWrite.mockRejectedValue(
      new AuthorizationError('Access denied to requested company'),
    );

    const result = await call();

    expect(result.success).toBe(false);
    expect(result.errorType).toBe('auth');
    expect(mockDb.insert).not.toHaveBeenCalled();
    expect(mockDb.update).not.toHaveBeenCalled();
  });
});
