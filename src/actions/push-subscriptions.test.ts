/**
 * @jest-environment node
 */
import {
  hasPushSubscription,
  removePushSubscription,
  savePushSubscription,
} from '@/actions/push-subscriptions';
import { db } from '@/lib/db';
import { requireActionAuth } from '@/lib/security';
import { AuthorizationError } from '@/lib/errors';
import { PgDialect } from 'drizzle-orm/pg-core';

const dialect = new PgDialect();

const insertValues = jest.fn();
const onConflictDoUpdate = jest.fn();
const deleteWhere = jest.fn();
jest.mock('@/lib/db', () => ({
  db: {
    insert: () => ({
      values: (values: unknown) => {
        insertValues(values);
        return { onConflictDoUpdate: (arg: unknown) => onConflictDoUpdate(arg) };
      },
    }),
    delete: () => ({ where: (...args: unknown[]) => deleteWhere(...args) }),
    query: { pushSubscription: { findFirst: jest.fn() } },
  },
}));
jest.mock('@/lib/security', () => ({ requireActionAuth: jest.fn() }));

const mockRequireActionAuth = requireActionAuth as jest.MockedFunction<typeof requireActionAuth>;
const mockFindFirst = db.query.pushSubscription.findFirst as jest.Mock;

const input = {
  endpoint: 'https://fcm.googleapis.com/fcm/send/abc',
  keys: { p256dh: 'p256', auth: 'auth' },
  userAgent: 'Chrome/Android',
};

describe('push subscription actions (ZIG-I20-2)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
    mockRequireActionAuth.mockResolvedValue({ userId: '7', companyId: 10, companyIsSystem: false });
    onConflictDoUpdate.mockResolvedValue(undefined);
    deleteWhere.mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('binds the subscription to the caller user and company; no company can be passed', async () => {
    const result = await savePushSubscription(input);

    expect(result).toEqual({ success: true });
    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        company_id: 10,
        user_id: 7n,
        endpoint: input.endpoint,
        p256dh: 'p256',
        auth: 'auth',
        user_agent: 'Chrome/Android',
      }),
    );
    expect(onConflictDoUpdate).toHaveBeenCalledTimes(1);
  });

  it('rejects a malformed subscription', async () => {
    const result = await savePushSubscription({
      endpoint: 'not a url',
      keys: { p256dh: '', auth: '' },
    });
    expect(result.success).toBe(false);
    expect(insertValues).not.toHaveBeenCalled();
  });

  it('removes and reports only the caller own endpoint', async () => {
    await removePushSubscription(input.endpoint);
    expect(deleteWhere).toHaveBeenCalledTimes(1);
    const { sql, params } = dialect.sqlToQuery(deleteWhere.mock.calls[0][0] as never);
    expect(sql).toContain('"endpoint" = ');
    expect(sql).toContain('"user_id" = ');
    expect(params).toEqual([input.endpoint, 7n]);

    mockFindFirst.mockResolvedValue(undefined);
    await expect(hasPushSubscription(input.endpoint)).resolves.toEqual({ success: true, data: false });
    mockFindFirst.mockResolvedValue({ id: 1 });
    await expect(hasPushSubscription(input.endpoint)).resolves.toEqual({ success: true, data: true });
  });

  it('fails closed without a session', async () => {
    mockRequireActionAuth.mockRejectedValue(new AuthorizationError('Authentication required'));
    expect((await savePushSubscription(input)).success).toBe(false);
    expect((await removePushSubscription(input.endpoint)).success).toBe(false);
    expect(insertValues).not.toHaveBeenCalled();
    expect(deleteWhere).not.toHaveBeenCalled();
  });
});
