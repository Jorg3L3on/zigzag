import {
  formatActivityFeed,
  formatActivityFeedItem,
  groupActivityFeedItems,
  isActivityFeedEvent,
  type ActivityFeedEventInput,
} from '@/lib/activity-feed';

const baseEvent = (
  overrides: Partial<ActivityFeedEventInput> = {},
): ActivityFeedEventInput => ({
  id: 1,
  occurredAt: '2026-07-24T12:00:00.000Z',
  actorUserId: '10',
  actorName: 'Juan Pérez',
  resourceType: 'ticket',
  resourceId: '521',
  action: 'created',
  result: 'success',
  payload: {
    ticket: { client_name: 'Acme', id: '521' },
  },
  ...overrides,
});

describe('activity-feed formatter', () => {
  it('excludes permission denied and non-success results', () => {
    expect(
      isActivityFeedEvent(
        baseEvent({ action: 'permission_denied', result: 'denied' }),
      ),
    ).toBe(false);
    expect(isActivityFeedEvent(baseEvent({ result: 'failed' }))).toBe(false);
  });

  it('formats ticket creation in natural language with a link', () => {
    const item = formatActivityFeedItem(baseEvent());
    expect(item).toMatchObject({
      title: 'Juan Pérez creó el ticket #521',
      description: 'Cliente: Acme',
      href: '/tickets/521',
      icon: 'ticket',
    });
  });

  it('formats payment events with amount when present', () => {
    const item = formatActivityFeedItem(
      baseEvent({
        action: 'payment_collected',
        payload: {
          payment: { appliedAmount: 1250 },
          after: { client_name: 'Acme' },
        },
      }),
    );
    expect(item?.title).toMatch(/registró un pago de/);
    expect(item?.title).toContain('#521');
    expect(item?.icon).toBe('payment');
  });

  it('formats client updates with quoted names', () => {
    const item = formatActivityFeedItem(
      baseEvent({
        resourceType: 'client',
        resourceId: '9',
        action: 'updated',
        payload: { after: { name: 'Acme' } },
      }),
    );
    expect(item).toMatchObject({
      title: 'Juan Pérez actualizó el cliente "Acme"',
      href: '/clients/9/edit',
      icon: 'client',
    });
  });

  it('maps company activation from status change', () => {
    const item = formatActivityFeedItem(
      baseEvent({
        resourceType: 'company',
        resourceId: '3',
        action: 'updated',
        payload: {
          before: { name: 'Beta', status: 'setup' },
          after: { name: 'Beta', status: 'active' },
        },
      }),
    );
    expect(item?.title).toBe('Juan Pérez activó la empresa "Beta"');
    expect(item?.action).toBe('activated');
  });

  it('disables links for deleted resources', () => {
    const item = formatActivityFeedItem(
      baseEvent({
        resourceType: 'client',
        action: 'updated',
        payload: { after: { name: 'Gone', deleted_at: '2026-07-01' } },
      }),
    );
    expect(item?.href).toBeNull();
  });

  it('groups consecutive identical events within the time window', () => {
    const items = formatActivityFeed([
      baseEvent({ id: 3, occurredAt: '2026-07-24T12:05:00.000Z' }),
      baseEvent({ id: 2, occurredAt: '2026-07-24T12:03:00.000Z' }),
      baseEvent({ id: 1, occurredAt: '2026-07-24T12:01:00.000Z' }),
    ]);

    expect(items).toHaveLength(1);
    expect(items[0].count).toBe(3);
    expect(items[0].title).toBe('Juan Pérez creó 3 tickets');
    expect(items[0].href).toBeNull();
  });

  it('does not group events outside the time window', () => {
    const items = groupActivityFeedItems([
      formatActivityFeedItem(
        baseEvent({ id: 2, occurredAt: '2026-07-24T14:00:00.000Z' }),
      )!,
      formatActivityFeedItem(
        baseEvent({ id: 1, occurredAt: '2026-07-24T12:00:00.000Z' }),
      )!,
    ]);
    expect(items).toHaveLength(2);
  });

  it('formats auth events without resource links', () => {
    const item = formatActivityFeedItem(
      baseEvent({
        resourceType: 'auth',
        action: 'signed_in',
        resourceId: '10',
        payload: null,
      }),
    );
    expect(item).toMatchObject({
      title: 'Juan Pérez inició sesión',
      href: null,
      icon: 'auth',
    });
  });
});
