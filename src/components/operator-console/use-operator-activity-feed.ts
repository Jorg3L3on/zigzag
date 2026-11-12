'use client';

import React from 'react';
import type { AuditEventListItem } from '@/lib/audit-query';
import { classifyClientError, getErrorMessageByType } from '@/lib/network-awareness';
import { buildActivityQuery, type ActivityFilters } from '@/lib/operator-activity';

type FeedState = {
  events: AuditEventListItem[];
  nextCursor: number | null;
  loading: boolean;
  loadingMore: boolean;
  /** First page failed: the list shows ListError. */
  error: string | null;
  /** «Cargar más» failed: rows stay, the footer shows the error (audit E8). */
  moreError: string | null;
};

const INITIAL: FeedState = {
  events: [],
  nextCursor: null,
  loading: true,
  loadingMore: false,
  error: null,
  moreError: null,
};

const fetchPage = async (
  filters: ActivityFilters,
  cursor: number | null,
  signal: AbortSignal,
): Promise<{ items: AuditEventListItem[]; nextCursor: number | null }> => {
  const response = await fetch(`/api/audit/events?${buildActivityQuery(filters, cursor).toString()}`, {
    signal,
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.success) {
    throw Object.assign(new Error(payload?.error || 'No se pudo cargar la actividad'), {
      status: response.status,
      errorType: payload?.errorType,
    });
  }
  return {
    items: (payload.data?.items ?? []) as AuditEventListItem[],
    nextCursor: payload.data?.nextCursor ?? null,
  };
};

const messageFor = (error: unknown): string => {
  const typed = error as { status?: number; errorType?: string; message?: string };
  return getErrorMessageByType(
    classifyClientError(error, typed?.status, typed?.errorType as never),
    typed?.message || 'No se pudo cargar la actividad',
  );
};

/**
 * The Actividad list with a cursor (ZIG-I38-5): a filter change aborts the
 * request in flight and starts over (no page from the old filters is pasted
 * onto the new list); a failed «Cargar más» keeps the rows and retries that
 * same page.
 */
export const useOperatorActivityFeed = (filters: ActivityFilters) => {
  const [state, setState] = React.useState<FeedState>(INITIAL);
  const generation = React.useRef(0);
  const controller = React.useRef<AbortController | null>(null);
  const key = JSON.stringify(filters);

  const loadFirst = React.useCallback(() => {
    controller.current?.abort();
    const abort = new AbortController();
    controller.current = abort;
    const gen = ++generation.current;
    setState({ ...INITIAL, loading: true });
    fetchPage(filters, null, abort.signal)
      .then((page) => {
        if (gen !== generation.current) return;
        setState({ ...INITIAL, loading: false, events: page.items, nextCursor: page.nextCursor });
      })
      .catch((error) => {
        if (gen !== generation.current || abort.signal.aborted) return;
        setState({ ...INITIAL, loading: false, error: messageFor(error) });
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  React.useEffect(() => {
    loadFirst();
    return () => controller.current?.abort();
  }, [loadFirst]);

  const loadMore = React.useCallback(() => {
    if (state.nextCursor == null || state.loadingMore) return;
    const gen = generation.current;
    const cursor = state.nextCursor;
    const abort = new AbortController();
    controller.current = abort;
    setState((current) => ({ ...current, loadingMore: true, moreError: null }));
    fetchPage(filters, cursor, abort.signal)
      .then((page) => {
        if (gen !== generation.current) return;
        setState((current) => ({
          ...current,
          loadingMore: false,
          events: [...current.events, ...page.items],
          nextCursor: page.nextCursor,
        }));
      })
      .catch((error) => {
        if (gen !== generation.current || abort.signal.aborted) return;
        setState((current) => ({ ...current, loadingMore: false, moreError: messageFor(error) }));
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, state.nextCursor, state.loadingMore]);

  return { ...state, retry: loadFirst, loadMore };
};
