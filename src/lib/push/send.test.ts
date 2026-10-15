/**
 * @jest-environment node
 */
import { PgDialect } from 'drizzle-orm/pg-core';
import {
  buildPushPayload,
  pushActionsFor,
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
      const { sql, params } = renderClause(clause);
      if (sql.includes('"read_at" is null')) {
        // Unread count for the app badge: user 1 has 3, user 2 has 1.
        return Promise.resolve([{ total: params.includes(1n) ? 3 : 1 }]);
      }
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
      url: '/tickets/create?clientId=7&serviceId=9&notification=1',
      tag: 'zigzag-schedule-5',
      type: 'schedule_due_soon',
      notificationId: 1,
      actions: [
        {
          action: 'crear',
          title: 'Crear ticket',
          url: '/tickets/create?clientId=7&serviceId=9&notification=1',
        },
        { action: 'ver', title: 'Ver', url: '/service-schedules?filter=proximos&notification=1' },
      ],
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
    ).toMatchObject({ url: '/company?notification=2', body: null, actions: [] });
  });

  it('offers actions by type, never more than two (ZIG-I21-2)', () => {
    expect(pushActionsFor({ ...companyA, type: 'schedule_overdue' })).toEqual([
      expect.objectContaining({ action: 'crear' }),
      { action: 'ver', title: 'Ver', url: '/service-schedules?filter=atrasados&notification=1' },
    ]);
    expect(
      pushActionsFor({
        ...companyA,
        type: 'export_ready',
        resource_type: 'company_export',
        resource_id: 'https://abc.public.blob.vercel-storage.com/exports/x.json',
      }),
    ).toEqual([
      {
        action: 'descargar',
        title: 'Descargar',
        url: 'https://abc.public.blob.vercel-storage.com/exports/x.json',
      },
    ]);
    // Only Vercel Blob downloads become a button.
    expect(
      pushActionsFor({
        ...companyA,
        type: 'export_ready',
        resource_type: 'company_export',
        resource_id: 'https://evil.example/x.json',
      }),
    ).toEqual([]);
    expect(
      pushActionsFor({ ...companyA, type: 'schedule_daily_digest', resource_id: 'atrasados' }),
    ).toEqual([]);
    expect(pushActionsFor({ ...companyA, resource_type: 'ticket', resource_id: '9' })).toEqual([]);
    for (const type of ['schedule_due_soon', 'schedule_overdue']) {
      expect(pushActionsFor({ ...companyA, type }).length).toBeLessThanOrEqual(2);
    }
  });

  it('a notification without a page still opens the dashboard and marks it read', () => {
    expect(
      buildPushPayload({ ...companyA, id: 3, resource_type: null, resource_id: null }).url,
    ).toBe('/dashboard?notification=3');
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

  it('each device gets its user\'s unread count for the app badge (ZIG-I21-3)', async () => {
    await sendPushForNotification(companyA);

    const unreadByEndpoint = Object.fromEntries(
      sendNotification.mock.calls.map((call) => [
        (call[0] as { endpoint: string }).endpoint,
        (JSON.parse(call[1] as string) as { unread: number }).unread,
      ]),
    );
    expect(unreadByEndpoint).toEqual({ 'https://push/a1': 3, 'https://push/a2': 1 });
    // The count is scoped to the notification's company and the user.
    const countClauses = selectWhere.mock.calls
      .map((call) => renderClause(call[0]))
      .filter(({ sql }) => sql.includes('"read_at" is null'));
    expect(countClauses).toHaveLength(2);
    for (const { params } of countClauses) {
      expect(params[0]).toBe(10);
    }
  });

  it('still sends when the unread count fails', async () => {
    selectWhere.mockImplementation((clause: unknown) => {
      const { sql } = renderClause(clause);
      if (sql.includes('"read_at" is null')) return Promise.reject(new Error('db down'));
      return Promise.resolve(subscriptionsByCompany[10]);
    });
    await expect(sendPushForNotification(companyA)).resolves.toBe(2);
    const payload = JSON.parse(sendNotification.mock.calls[0][1] as string) as Record<string, unknown>;
    expect(payload).not.toHaveProperty('unread');
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
