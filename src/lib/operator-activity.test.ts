import {
  activityChanges,
  activityResult,
  activitySentence,
  buildActivityQuery,
  describeUserAgent,
  groupOperatorActivityEvents,
} from '@/lib/operator-activity';
import type { AuditEventListItem } from '@/lib/audit-query';

const baseEvent = (
  overrides: Partial<AuditEventListItem> & Pick<AuditEventListItem, 'id'>,
): AuditEventListItem => ({
  id: overrides.id,
  occurred_at: overrides.occurred_at ?? '2026-07-07T12:00:00.000Z',
  actor_user_id: overrides.actor_user_id ?? '10',
  actor_name: overrides.actor_name ?? 'Ana',
  actor_company_id: overrides.actor_company_id ?? 2,
  actor_company_name: overrides.actor_company_name ?? null,
  target_company_name: overrides.target_company_name ?? null,
  target_company_id: overrides.target_company_id ?? 2,
  resource_type: overrides.resource_type ?? 'auth',
  resource_id: overrides.resource_id ?? '10',
  action: overrides.action ?? 'signed_in',
  result: overrides.result ?? 'success',
  source: overrides.source ?? 'auth',
  payload: overrides.payload ?? null,
  request_meta: overrides.request_meta ?? null,
});

describe('groupOperatorActivityEvents', () => {
  it('collapses consecutive auth session events from the same actor', () => {
    const grouped = groupOperatorActivityEvents([
      baseEvent({ id: 3, occurred_at: '2026-07-07T12:10:00.000Z' }),
      baseEvent({ id: 2, occurred_at: '2026-07-07T12:05:00.000Z' }),
      baseEvent({ id: 1, occurred_at: '2026-07-07T12:00:00.000Z' }),
    ]);

    expect(grouped).toHaveLength(1);
    expect(grouped[0]?.count).toBe(3);
    expect(grouped[0]?.eventIds).toEqual([3, 2, 1]);
  });

  it('does not group ticket or unrelated activity rows', () => {
    const grouped = groupOperatorActivityEvents([
      baseEvent({
        id: 2,
        resource_type: 'ticket',
        action: 'generated',
        resource_id: '1004',
      }),
      baseEvent({
        id: 1,
        resource_type: 'ticket',
        action: 'generated',
        resource_id: '1004',
      }),
    ]);

    expect(grouped).toHaveLength(2);
  });
});

describe('Actividad helpers (ZIG-I38-5)', () => {
  const now = new Date('2026-11-11T12:00:00.000Z');

  it('sends from, to and actor_user_id to the API', () => {
    const params = buildActivityQuery(
      {
        companyId: 12,
        search: '',
        date: '7d',
        actorUserId: '44',
        action: 'updated',
        alertsOnly: true,
      },
      77,
      now,
    );
    expect(params.get('target_company_id')).toBe('12');
    expect(params.get('from')).toBe('2026-11-04T12:00:00.000Z');
    expect(params.get('to')).toBe(now.toISOString());
    expect(params.get('actor_user_id')).toBe('44');
    expect(params.get('action')).toBe('updated');
    expect(params.get('incidents_only')).toBe('1');
    expect(params.get('cursor')).toBe('77');
  });

  it('omits the dates for the whole history', () => {
    const params = buildActivityQuery({
      companyId: 1, search: '', date: 'all', actorUserId: null, action: null, alertsOnly: false,
    });
    expect(params.has('from')).toBe(false);
    expect(params.has('actor_user_id')).toBe(false);
  });

  it('keeps the times of a grouped row and says how many times', () => {
    const grouped = groupOperatorActivityEvents([
      baseEvent({ id: 3, action: 'signed_in', occurred_at: '2026-07-07T12:10:00.000Z' }),
      baseEvent({ id: 2, action: 'signed_in', occurred_at: '2026-07-07T12:05:00.000Z' }),
    ]);
    expect(grouped[0].times).toEqual(['2026-07-07T12:10:00.000Z', '2026-07-07T12:05:00.000Z']);
    expect(activitySentence(grouped[0])).toBe('Ana inició sesión, 2 veces');
  });

  it('marks 5 grouped failed sign-ins as an alert', () => {
    const grouped = groupOperatorActivityEvents(
      [5, 4, 3, 2, 1].map((id) =>
        baseEvent({ id, action: 'sign_in_failed', result: 'failed', occurred_at: `2026-07-07T12:0${id}:00.000Z` }),
      ),
    );
    expect(activityResult(grouped[0])).toEqual({ label: 'Alerta', tone: 'red' });
  });

  it('lists only the fields that changed', () => {
    expect(
      activityChanges({ before: { status: 'ACTIVE', name: 'A' }, after: { status: 'SUSPENDED', name: 'A' } }),
    ).toEqual([{ field: 'status', before: 'ACTIVE', after: 'SUSPENDED' }]);
  });

  it('reads a device from the user agent', () => {
    expect(
      describeUserAgent('Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/130 Mobile Safari/537.36'),
    ).toBe('Chrome en Android');
  });
});
