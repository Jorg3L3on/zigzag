'use client';

import { useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';

import { toast } from 'sonner';
import { shouldRenewSession, shouldWarnSessionExpiry } from '@/lib/session-policy';

const FAILURE_COOLDOWN_MS = 5 * 60 * 1000;
const CHECK_INTERVAL_MS = 60 * 1000;
const WARNING_TOAST_ID = 'session-expiry-warning';

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
      if (!shouldRenewSession(remainingMs, session?.user?.remember)) {
        return;
      }

      isRefreshingRef.current = true;

      try {
        await update();
        lastFailureAtRef.current = null;
        toast.dismiss(WARNING_TOAST_ID);
      } catch {
        lastFailureAtRef.current = Date.now();
      } finally {
        isRefreshingRef.current = false;
      }
    };

    const handleVisibilityChange = () => {
      void refreshIfNearExpiry();
    };

    // An app left open all day never fires visibilitychange, so also check on a
    // timer; this is what keeps a session sliding while it is in use.
    const intervalId = window.setInterval(() => {
      void refreshIfNearExpiry();
      warnIfAboutToExpire();
    }, CHECK_INTERVAL_MS);

    const warnIfAboutToExpire = () => {
      if (status !== 'authenticated') return;
      if (!shouldWarnSessionExpiry(getSessionTimeRemaining(session?.expires))) return;
      toast.warning('Tu sesión está por vencer', {
        id: WARNING_TOAST_ID,
        duration: Number.POSITIVE_INFINITY,
        description: 'Toca para seguir conectado y no perder tu trabajo.',
        action: {
          label: 'Seguir conectado',
          onClick: () => {
            void update();
          },
        },
      });
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    void refreshIfNearExpiry();

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [session?.expires, session?.user?.remember, status, update]);

  return null;
}
