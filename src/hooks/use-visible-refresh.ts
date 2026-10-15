'use client';

import { useEffect, useRef } from 'react';

/**
 * Run `refresh` when the user comes back to the app (`visibilitychange` to
 * visible, window `focus`) and every `intervalMs` while the tab is visible.
 * Nothing runs while the tab is hidden: a backgrounded tab must not keep a
 * Vercel function or a Postgres connection busy (ZIG-I20-3 replaced the SSE
 * stream of `/api/realtime` with this).
 *
 * The callback is kept in a ref so the listeners are registered once.
 */
export const useVisibleRefresh = (
  refresh: () => void | Promise<void>,
  intervalMs: number,
): void => {
  const refreshRef = useRef(refresh);
  useEffect(() => {
    refreshRef.current = refresh;
  }, [refresh]);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return;
    }

    let timer: number | null = null;
    const run = () => {
      void refreshRef.current();
    };
    const stop = () => {
      if (timer !== null) {
        window.clearInterval(timer);
        timer = null;
      }
    };
    const start = () => {
      stop();
      if (document.visibilityState === 'visible') {
        timer = window.setInterval(run, intervalMs);
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        run();
        start();
      } else {
        stop();
      }
    };
    const onFocus = () => {
      if (document.visibilityState === 'visible') {
        run();
        start();
      }
    };

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('focus', onFocus);
    start();

    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', onFocus);
    };
  }, [intervalMs]);
};
