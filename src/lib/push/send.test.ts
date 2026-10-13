/**
 * @jest-environment node
 */
import { PgDialect } from 'drizzle-orm/pg-core';
import {
  buildPushPayload,
  pushTagFor,
  sendPushForNotification,
  sendPushForNotifications,
} from '@/lib/push/send';

const dialect = new PgDialect();
/** The SQL and params a drizzle where-clause renders to. */
const renderClause = (clause: unknown) => dialect.sqlToQuery(clause as never);

const sendNotification = jest.fn();
jest.mock('web-push', () => ({
  __esModule: true,
  default: { setVapidDetails: jest.fn(), sendNotification: (...args: unknown[]) => sendNotification(...args) },
}));

const selectWhere = jest.fn();
const deleteWhere = jest.fn();
jest.mock('@/lib/db', () => ({
  db: {
    select: () => ({ from: () => ({ where: (...args: unknown[]) => selectWhere(...args) }) }),
    delete: () => ({ where: (...args: unknown[]) => deleteWhere(...args) }),
  },
}));
jest.mock('@/lib/logger', () => ({ logger: { warn: jest.fn() } }));

const companyA = {
  id: 1,
  company_id: 10,
  user_id: null,
  type: 'schedule_due_soon',
  title: 'Servicio próximo',
  body: 'Mantenimiento para Cliente A',
  resource_type: 'client_service_schedule',
  resource_id: '5:7:9',
};

/** What the (mocked) query returns, keyed by the SQL the where clause renders. */
const subscriptionsByCompany: Record<number, Array<Record<string, unknown>>> = {
  10: [
    { id: 100, company_id: 10, user_id: 1n, endpoint: 'https://push/a1', p256dh: 'k', auth: 'a' },
    { id: 101, company_id: 10, user_id: 2n, endpoint: 'https://push/a2', p256dh: 'k', auth: 'a' },
  ],
  20: [{ id: 200, company_id: 20, user_id: 3n, endpoint: 'https://push/b1', p256dh: 'k', auth: 'a' }],
};

describe('Web Push send (ZIG-I20-2)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.VAPID_PUBLIC_KEY = 'pub';
    process.env.VAPID_PRIVATE_KEY = 'priv';
    selectWhere.mockImplementation((clause: unknown) => {
      // Resolve the company filter from the bound params of the where clause.
      const { params } = renderClause(clause);
      const companyId = params.includes(10) ? 10 : 20;
      return Promise.resolve(subscriptionsByCompany[companyId]);
    });
    sendNotification.mockResolvedValue({ statusCode: 201 });
  });

  afterAll(() => {
    delete process.env.VAPID_PUBLIC_KEY;
    delete process.env.VAPID_PRIVATE_KEY;
  });

  it('builds the payload the service worker shows, with the page to open', () => {
    expect(buildPushPayload(companyA)).toEqual({
      title: 'Servicio próximo',
      body: 'Mantenimiento para Cliente A',
      url: '/tickets/create?clientId=7&serviceId=9',
      tag: 'zigzag-schedule-5',
      type: 'schedule_due_soon',
      notificationId: 1,
      actions: [],
    });
    expect(
      buildPushPayload({
        ...companyA,
        id: 2,
        type: 'export_ready',
        resource_type: 'company_export',
        resource_id: 'https://blob/export.json',
        body: null,
      }),
    ).toMatchObject({ url: '/company', body: null });
  });

  it('tags by schedule, by digest, or by notification (ZIG-I21-1)', () => {
    expect(pushTagFor({ ...companyA, type: 'schedule_overdue' })).toBe('zigzag-schedule-5');
    expect(
      pushTagFor({ ...companyA, type: 'schedule_daily_digest', resource_id: 'atrasados' }),
    ).toBe('zigzag-schedule-digest');
    expect(
      pushTagFor({ ...companyA, id: 8, type: 'export_ready', resource_type: 'company_export' }),
    ).toBe('zigzag-notification-8');
  });

  it('sends a company notification only to that company (never another company)', async () => {
    const delivered = await sendPushForNotification(companyA);

    expect(delivered).toBe(2);
    const endpoints = sendNotification.mock.calls.map((call) => (call[0] as { endpoint: string }).endpoint);
    expect(endpoints.sort()).toEqual(['https://push/a1', 'https://push/a2']);
    expect(endpoints).not.toContain('https://push/b1');
    for (const call of sendNotification.mock.calls) {
      const payload = JSON.parse(call[1] as string) as { body: string };
      expect(payload.body).toBe('Mantenimiento para Cliente A');
    }
    // The query is scoped by the notification's company id.
    const { sql, params } = renderClause(selectWhere.mock.calls[0][0]);
    expect(sql).toContain('"company_id" = ');
    expect(params).toEqual([10]);
  });

  it('deletes subscriptions the push service reports gone (404/410) and keeps the rest', async () => {
    sendNotification.mockImplementation((subscription: { endpoint: string }) =>
      subscription.endpoint.endsWith('a2')
        ? Promise.reject(Object.assign(new Error('gone'), { statusCode: 410 }))
        : Promise.resolve({ statusCode: 201 }),
    );

    const delivered = await sendPushForNotification(companyA);

    expect(delivered).toBe(1);
    expect(deleteWhere).toHaveBeenCalledTimes(1);
  });

  it('is a no-op without VAPID keys (zero cost, bell still works)', async () => {
    delete process.env.VAPID_PUBLIC_KEY;
    await sendPushForNotifications([companyA]);
    expect(selectWhere).not.toHaveBeenCalled();
    expect(sendNotification).not.toHaveBeenCalled();
  });
});
