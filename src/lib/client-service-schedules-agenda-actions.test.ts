import {
  bulkClientServiceSchedules,
  getClientServiceScheduleHistory,
  listClientServiceSchedulesPaginated,
  markClientServiceScheduleDone,
  restoreClientServiceScheduleDates,
  snoozeClientServiceSchedule,
} from '@/actions/client-service-schedules';
import { db } from '@/lib/db';
import { AuthorizationError } from '@/lib/errors';
import {
  requireScheduleRead,
  requireScheduleWrite,
} from '@/lib/service-schedules-rbac-server';

/** A drizzle select/update chain that resolves to `result` when awaited. */
const chain = (result: unknown) => {
  const node: Record<string, unknown> = {};
  for (const method of [
    'from',
    'innerJoin',
    'leftJoin',
    'where',
    'orderBy',
    'limit',
    'offset',
    'set',
    'returning',
  ]) {
    node[method] = jest.fn(() => node);
  }
  node.then = (resolve: (value: unknown) => unknown, reject: (e: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject);
  return node;
};

jest.mock('@/lib/db', () => ({
  db: {
    query: {
      clientServiceSchedule: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
      },
    },
    select: jest.fn(),
    insert: jest.fn(),
    update: jest.fn(),
    transaction: jest.fn(),
  },
}));

jest.mock('@/lib/service-schedules-rbac-server', () => ({
  requireScheduleRead: jest.fn(),
  requireScheduleWrite: jest.fn(),
}));

jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }));

const mockRead = requireScheduleRead as jest.Mock;
const mockWrite = requireScheduleWrite as jest.Mock;
const mockDb = db as unknown as {
  query: { clientServiceSchedule: { findFirst: jest.Mock } };
  select: jest.Mock;
  update: jest.Mock;
  transaction: jest.Mock;
};

const COMPANY_ID = 4;
const NOW = new Date('2026-10-25T18:00:00.000Z');

const scheduleRow = (overrides: Record<string, unknown> = {}) => ({
  id: 11,
  company_id: COMPANY_ID,
  client_id: 1,
  service_id: 2,
  interval_value: 6,
  interval_unit: 'month',
  last_service_at: new Date('2026-04-10T12:00:00.000Z'),
  next_due_at: new Date('2026-10-10T12:00:00.000Z'),
  paused_at: null,
  pause_reason: null,
  created_at: new Date('2026-04-10T18:00:00.000Z'),
  updated_at: null,
  deleted_at: null,
  ...overrides,
});

describe('ZIG-I30 schedule agenda actions', () => {
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers({ now: NOW, doNotFake: ['nextTick', 'setImmediate'] });
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockRead.mockResolvedValue({ companyId: COMPANY_ID });
    mockWrite.mockResolvedValue({ companyId: COMPANY_ID });
  });

  afterEach(() => {
    jest.useRealTimers();
    consoleErrorSpy.mockRestore();
  });

  describe('markClientServiceScheduleDone', () => {
    it('sets the last service to the day and reschedules by the interval', async () => {
      mockDb.query.clientServiceSchedule.findFirst.mockResolvedValue(scheduleRow());
      const updateChain = chain([{ id: 11 }]);
      mockDb.update.mockReturnValue(updateChain);

      const result = await markClientServiceScheduleDone(11, '2026-10-20', COMPANY_ID);

      expect(result.success).toBe(true);
      expect(updateChain.set).toHaveBeenCalledWith(
        expect.objectContaining({
          last_service_at: new Date('2026-10-20T12:00:00.000Z'),
          next_due_at: new Date('2027-04-20T12:00:00.000Z'),
        }),
      );
      expect(result.data).toEqual({
        applied: {
          id: 11,
          lastServiceAt: '2026-10-20T12:00:00.000Z',
          nextDueAt: '2027-04-20T12:00:00.000Z',
        },
        previous: {
          id: 11,
          lastServiceAt: '2026-04-10T12:00:00.000Z',
          nextDueAt: '2026-10-10T12:00:00.000Z',
        },
      });
    });

    it('rejects a paused schedule without writing', async () => {
      mockDb.query.clientServiceSchedule.findFirst.mockResolvedValue(
        scheduleRow({ paused_at: new Date('2026-09-01T12:00:00.000Z') }),
      );

      const result = await markClientServiceScheduleDone(11, '2026-10-20', COMPANY_ID);

      expect(result).toMatchObject({ success: false, errorCode: 'SS003' });
      expect(mockDb.update).not.toHaveBeenCalled();
    });

    it.each([
      ['a future day', '2026-10-26'],
      ['a day before the last service', '2026-04-09'],
      ['an invalid day', '2026-02-30'],
    ])('rejects %s', async (_label, doneOn) => {
      mockDb.query.clientServiceSchedule.findFirst.mockResolvedValue(scheduleRow());

      const result = await markClientServiceScheduleDone(11, doneOn, COMPANY_ID);

      expect(result).toMatchObject({ success: false, errorCode: 'SS002' });
      expect(mockDb.update).not.toHaveBeenCalled();
    });

    it('accepts today and the day of the last service', async () => {
      mockDb.query.clientServiceSchedule.findFirst.mockResolvedValue(scheduleRow());
      mockDb.update.mockReturnValue(chain([{ id: 11 }]));

      expect((await markClientServiceScheduleDone(11, '2026-10-25', COMPANY_ID)).success).toBe(
        true,
      );
      expect((await markClientServiceScheduleDone(11, '2026-04-10', COMPANY_ID)).success).toBe(
        true,
      );
    });

    it('answers SS001 for a schedule of another company', async () => {
      mockDb.query.clientServiceSchedule.findFirst.mockResolvedValue(undefined);

      const result = await markClientServiceScheduleDone(11, '2026-10-20', COMPANY_ID);

      expect(result).toMatchObject({ success: false, errorCode: 'SS001' });
    });
  });

  describe('snoozeClientServiceSchedule', () => {
    it.each([7, 14, 30])('moves an overdue schedule %i days from today', async (days) => {
      mockDb.query.clientServiceSchedule.findFirst.mockResolvedValue(scheduleRow());
      const updateChain = chain([{ id: 11 }]);
      mockDb.update.mockReturnValue(updateChain);

      const result = await snoozeClientServiceSchedule(11, { days }, COMPANY_ID);

      const expected = new Date(Date.UTC(2026, 9, 25 + days, 12));
      expect(result).toEqual({
        success: true,
        data: {
          nextDueAt: expected.toISOString(),
          previousNextDueAt: '2026-10-10T12:00:00.000Z',
        },
      });
      expect(updateChain.set).toHaveBeenCalledWith(
        expect.objectContaining({ next_due_at: expected }),
      );
    });

    it('moves to a chosen date', async () => {
      mockDb.query.clientServiceSchedule.findFirst.mockResolvedValue(scheduleRow());
      mockDb.update.mockReturnValue(chain([{ id: 11 }]));

      const result = await snoozeClientServiceSchedule(11, { until: '2026-12-01' }, COMPANY_ID);

      expect(result.data?.nextDueAt).toBe('2026-12-01T12:00:00.000Z');
    });

    it.each([
      ['a past date', { until: '2026-10-24' }],
      ['10 days', { days: 10 }],
    ])('rejects %s', async (_label, input) => {
      mockDb.query.clientServiceSchedule.findFirst.mockResolvedValue(scheduleRow());

      const result = await snoozeClientServiceSchedule(11, input, COMPANY_ID);

      expect(result).toMatchObject({ success: false, errorCode: 'SS002' });
      expect(mockDb.update).not.toHaveBeenCalled();
    });

    it('rejects a paused schedule', async () => {
      mockDb.query.clientServiceSchedule.findFirst.mockResolvedValue(
        scheduleRow({ paused_at: new Date('2026-09-01T12:00:00.000Z') }),
      );

      const result = await snoozeClientServiceSchedule(11, { days: 7 }, COMPANY_ID);

      expect(result).toMatchObject({ success: false, errorCode: 'SS003' });
      expect(mockDb.update).not.toHaveBeenCalled();
    });
  });

  describe('bulkClientServiceSchedules', () => {
    const runTransaction = (selectResult: unknown[]) => {
      const tx = {
        select: jest.fn(() => chain(selectResult)),
        update: jest.fn(() => chain(undefined)),
      };
      mockDb.transaction.mockImplementation(async (callback: (t: typeof tx) => unknown) =>
        callback(tx),
      );
      return tx;
    };

    it('applies nothing when one id belongs to another company', async () => {
      const tx = runTransaction([
        { id: 1, next_due_at: NOW, last_service_at: null, paused_at: null },
      ]);

      const result = await bulkClientServiceSchedules({
        ids: [1, 999],
        action: 'delete',
        companyId: COMPANY_ID,
      });

      expect(result).toMatchObject({ success: false, errorCode: 'SS001' });
      expect(tx.update).not.toHaveBeenCalled();
    });

    it('rejects more than 50 ids or an empty list before reading', async () => {
      const ids = Array.from({ length: 51 }, (_, index) => index + 1);

      expect(
        await bulkClientServiceSchedules({ ids, action: 'pause', companyId: COMPANY_ID }),
      ).toMatchObject({ success: false, errorCode: 'SS004' });
      expect(
        await bulkClientServiceSchedules({ ids: [], action: 'pause', companyId: COMPANY_ID }),
      ).toMatchObject({ success: false, errorCode: 'SS004' });
      expect(mockDb.transaction).not.toHaveBeenCalled();
    });

    it('rejects a snooze to a past date before reading', async () => {
      const result = await bulkClientServiceSchedules({
        ids: [1, 2],
        action: 'snooze',
        snooze: { until: '2026-10-01' },
        companyId: COMPANY_ID,
      });

      expect(result).toMatchObject({ success: false, errorCode: 'SS002' });
      expect(mockDb.transaction).not.toHaveBeenCalled();
    });

    it('snoozes the active ones, skips the paused one and returns the old dates', async () => {
      const tx = runTransaction([
        {
          id: 1,
          next_due_at: new Date('2026-10-01T12:00:00.000Z'),
          last_service_at: null,
          paused_at: null,
        },
        {
          id: 2,
          next_due_at: new Date('2026-11-30T12:00:00.000Z'),
          last_service_at: new Date('2026-05-30T12:00:00.000Z'),
          paused_at: null,
        },
        {
          id: 3,
          next_due_at: new Date('2026-08-01T12:00:00.000Z'),
          last_service_at: null,
          paused_at: new Date('2026-08-02T12:00:00.000Z'),
        },
      ]);

      const result = await bulkClientServiceSchedules({
        ids: [1, 2, 3],
        action: 'snooze',
        snooze: { days: 14 },
        companyId: COMPANY_ID,
      });

      expect(result.success).toBe(true);
      expect(result.data?.appliedIds).toEqual([1, 2]);
      expect(result.data?.previous).toEqual([
        { id: 1, lastServiceAt: null, nextDueAt: '2026-10-01T12:00:00.000Z' },
        {
          id: 2,
          lastServiceAt: '2026-05-30T12:00:00.000Z',
          nextDueAt: '2026-11-30T12:00:00.000Z',
        },
      ]);
      expect(tx.update).toHaveBeenCalledTimes(2);
      const sets = tx.update.mock.results.map(
        (entry) => (entry.value.set as jest.Mock).mock.calls[0][0].next_due_at,
      );
      expect(sets).toEqual([
        new Date('2026-11-08T12:00:00.000Z'),
        new Date('2026-12-14T12:00:00.000Z'),
      ]);
    });

    it('deletes every id in one update', async () => {
      const tx = runTransaction([
        { id: 1, next_due_at: NOW, last_service_at: null, paused_at: null },
        { id: 2, next_due_at: NOW, last_service_at: null, paused_at: NOW },
      ]);

      const result = await bulkClientServiceSchedules({
        ids: [1, 2, 2],
        action: 'delete',
        companyId: COMPANY_ID,
      });

      expect(result.data).toEqual({ appliedIds: [1, 2], previous: [] });
      expect(tx.update).toHaveBeenCalledTimes(1);
    });
  });

  describe('restoreClientServiceScheduleDates', () => {
    it('applies nothing when one id belongs to another company', async () => {
      const tx = {
        select: jest.fn(() => chain([{ id: 1 }])),
        update: jest.fn(() => chain(undefined)),
      };
      mockDb.transaction.mockImplementation(async (callback: (t: typeof tx) => unknown) =>
        callback(tx),
      );

      const result = await restoreClientServiceScheduleDates(
        [
          { id: 1, lastServiceAt: null, nextDueAt: '2026-10-01T12:00:00.000Z' },
          { id: 2, lastServiceAt: null, nextDueAt: '2026-10-01T12:00:00.000Z' },
        ],
        COMPANY_ID,
      );

      expect(result).toMatchObject({ success: false, errorCode: 'SS001' });
      expect(tx.update).not.toHaveBeenCalled();
    });
  });

  describe('cross-tenant IDOR - agenda actions', () => {
    it.each([
      ['listClientServiceSchedulesPaginated', () => listClientServiceSchedulesPaginated({ companyId: 99 })],
      ['getClientServiceScheduleHistory', () => getClientServiceScheduleHistory(11, 99)],
    ])('%s denies cross-tenant company context', async (_name, call) => {
      mockRead.mockRejectedValue(new AuthorizationError('Access denied to requested company'));

      const result = await call();

      expect(result).toMatchObject({ success: false, errorType: 'auth' });
      expect(mockDb.select).not.toHaveBeenCalled();
    });

    it.each([
      ['markClientServiceScheduleDone', () => markClientServiceScheduleDone(11, '2026-10-20', 99)],
      ['bulkClientServiceSchedules', () => bulkClientServiceSchedules({ ids: [11], action: 'delete', companyId: 99 })],
      [
        'restoreClientServiceScheduleDates',
        () => restoreClientServiceScheduleDates([{ id: 11, lastServiceAt: null, nextDueAt: NOW.toISOString() }], 99),
      ],
    ])('%s denies cross-tenant company context', async (_name, call) => {
      mockWrite.mockRejectedValue(new AuthorizationError('Access denied to requested company'));

      const result = await call();

      expect(result).toMatchObject({ success: false, errorType: 'auth' });
      expect(mockDb.update).not.toHaveBeenCalled();
      expect(mockDb.transaction).not.toHaveBeenCalled();
    });
  });
});
