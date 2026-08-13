import { groupOperatorActivityEvents } from '@/lib/operator-activity';
import type { AuditEventListItem } from '@/lib/audit-query';

const baseEvent = (
  overrides: Partial<AuditEventListItem> & Pick<AuditEventListItem, 'id'>,
): AuditEventListItem => ({
  id: overrides.id,
  occurred_at: overrides.occurred_at ?? '2026-07-07T12:00:00.000Z',
  actor_user_id: overrides.actor_user_id ?? '10',
  actor_name: overrides.actor_name ?? 'Ana',
  actor_company_id: overrides.actor_company_id ?? 2,
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
