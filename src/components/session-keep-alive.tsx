'use client';

import { useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';

const REFRESH_WINDOW_MS = 15 * 60 * 1000;
const FAILURE_COOLDOWN_MS = 5 * 60 * 1000;

const getSessionTimeRemaining = (expires: string | undefined) => {
  if (!expires) {
    return Number.POSITIVE_INFINITY;
  }

  const expiresAt = new Date(expires).getTime();

  if (Number.isNaN(expiresAt)) {
    return Number.POSITIVE_INFINITY;
  }

  return expiresAt - Date.now();
};

export function SessionKeepAlive() {
  const { data: session, status, update } = useSession();
  const isRefreshingRef = useRef(false);
  const lastFailureAtRef = useRef<number | null>(null);

  useEffect(() => {
    const refreshIfNearExpiry = async () => {
      if (
        document.visibilityState !== 'visible' ||
        status !== 'authenticated' ||
        isRefreshingRef.current
      ) {
        return;
      }

      const lastFailureAt = lastFailureAtRef.current;
      if (lastFailureAt && Date.now() - lastFailureAt < FAILURE_COOLDOWN_MS) {
        return;
      }

      const remainingMs = getSessionTimeRemaining(session?.expires);
      if (remainingMs <= 0 || remainingMs > REFRESH_WINDOW_MS) {
        return;
      }

      isRefreshingRef.current = true;

      try {
        await update();
        lastFailureAtRef.current = null;
      } catch {
        lastFailureAtRef.current = Date.now();
      } finally {
        isRefreshingRef.current = false;
      }
    };

    const handleVisibilityChange = () => {
      void refreshIfNearExpiry();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [session?.expires, status, update]);

  return null;
}
