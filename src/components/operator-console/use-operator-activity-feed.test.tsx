/**
 * @jest-environment jsdom
 */
import { act, renderHook, waitFor } from '@testing-library/react';
import { useOperatorActivityFeed } from '@/components/operator-console/use-operator-activity-feed';
import type { ActivityFilters } from '@/lib/operator-activity';

const event = (id: number) => ({
  id,
  occurred_at: `2026-11-11T12:${String(60 - id).padStart(2, '0')}:00.000Z`,
  actor_user_id: '1',
  actor_name: 'Ana',
  actor_company_id: 4,
  actor_company_name: null,
  target_company_id: 4,
  target_company_name: null,
  resource_type: 'ticket',
  resource_id: String(id),
  action: 'created',
  result: 'success',
  source: 'action',
  payload: null,
  request_meta: null,
});

const ok = (ids: number[], nextCursor: number | null) =>
  Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve({ success: true, data: { items: ids.map(event), nextCursor } }),
  });

const fail = () =>
  Promise.resolve({
    ok: false,
    status: 500,
    json: () => Promise.resolve({ success: false, error: 'Falló' }),
  });

const filters = (overrides: Partial<ActivityFilters> = {}): ActivityFilters => ({
  companyId: 4,
  search: '',
  date: '7d',
  actorUserId: null,
  action: null,
  alertsOnly: false,
  ...overrides,
});

describe('useOperatorActivityFeed (ZIG-I38-5, audit E8)', () => {
  const fetchMock = jest.fn();
  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  it('keeps the loaded rows when «Cargar más» fails and retries that same page', async () => {
    fetchMock.mockReturnValueOnce(ok([1, 2], 2)).mockReturnValueOnce(fail()).mockReturnValueOnce(ok([3], null));
    const { result } = renderHook(() => useOperatorActivityFeed(filters()));
    await waitFor(() => expect(result.current.events).toHaveLength(2));

    act(() => result.current.loadMore());
    await waitFor(() => expect(result.current.moreError).toBeTruthy());
    expect(result.current.events.map((e) => e.id)).toEqual([1, 2]);
    expect(result.current.error).toBeNull();

    act(() => result.current.loadMore());
    await waitFor(() => expect(result.current.events.map((e) => e.id)).toEqual([1, 2, 3]));
    expect(String(fetchMock.mock.calls[2][0])).toContain('cursor=2');
    expect(String(fetchMock.mock.calls[1][0])).toContain('cursor=2');
  });

  it('never pastes a page of the old filters onto the new list', async () => {
    let releaseOld: (value: unknown) => void = () => undefined;
    fetchMock
      .mockReturnValueOnce(ok([1, 2], 2))
      .mockReturnValueOnce(new Promise((resolve) => (releaseOld = resolve)))
      .mockReturnValueOnce(ok([9], null));
    const { result, rerender } = renderHook((props: ActivityFilters) => useOperatorActivityFeed(props), {
      initialProps: filters(),
    });
    await waitFor(() => expect(result.current.events).toHaveLength(2));

    act(() => result.current.loadMore()); // page 2 of the old filters, still in flight
    rerender(filters({ alertsOnly: true }));
    await waitFor(() => expect(result.current.events.map((e) => e.id)).toEqual([9]));

    await act(async () => {
      releaseOld({ ok: true, status: 200, json: () => Promise.resolve({ success: true, data: { items: [event(3)], nextCursor: null } }) });
    });
    expect(result.current.events.map((e) => e.id)).toEqual([9]);
    expect(String(fetchMock.mock.calls[2][0])).toContain('incidents_only=1');
  });
});
