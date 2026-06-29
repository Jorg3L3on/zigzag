'use client';

import { useEffect, useRef } from 'react';

export type RealtimeClientEvent = {
  type: string;
  companyId: number | null;
  resourceType?: string;
  resourceId?: string | null;
  at?: string;
};

/**
 * Subscribe to the server-sent realtime stream (`/api/realtime`, backed by
 * Postgres LISTEN/NOTIFY). Calls `onEvent` for each event. EventSource handles
 * reconnection automatically. The handler is kept in a ref so the connection is
 * not torn down on every render.
 */
export const useRealtimeEvents = (
  onEvent: (event: RealtimeClientEvent) => void,
  options?: { enabled?: boolean },
): void => {
  const handlerRef = useRef(onEvent);
  useEffect(() => {
    handlerRef.current = onEvent;
  }, [onEvent]);

  const enabled = options?.enabled ?? true;

  useEffect(() => {
    if (!enabled || typeof window === 'undefined' || !('EventSource' in window)) {
      return;
    }

    const source = new EventSource('/api/realtime');
    source.onmessage = (message) => {
      try {
        const event = JSON.parse(message.data) as RealtimeClientEvent;
        handlerRef.current(event);
      } catch {
        // ignore malformed events
      }
    };
    // On error EventSource auto-reconnects; nothing to do here.

    return () => {
      source.close();
    };
  }, [enabled]);
};
