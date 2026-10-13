'use client';

import * as React from 'react';

import { getUnreadNotificationCount } from '@/actions/notifications';
import { POLL_INTERVAL_MS } from '@/components/notifications/notification-bell';
import { useDisplayModeStandalone } from '@/hooks/use-display-mode-standalone';
import { useVisibleRefresh } from '@/hooks/use-visible-refresh';
import { supportsAppBadge, syncAppBadge } from '@/lib/app-badge';
import { NOTIFICATIONS_CHANGED_EVENT } from '@/lib/notifications-events';

/**
 * Keeps the installed app's icon badge equal to the unread notifications
 * (ZIG-I21-3). Lives in the (app) layout because on phones the bell sits in
 * the closed sidebar sheet. Runs only in the installed app on a browser with
 * the Badging API, so desktop tabs make no extra requests; the push handler
 * in the service worker updates the badge while the app is closed.
 */
export const AppBadgeSync = () => {
  const isStandalone = useDisplayModeStandalone();
  const enabled = isStandalone && supportsAppBadge();

  const refresh = React.useCallback(async () => {
    if (!enabled) return;
    try {
      const result = await getUnreadNotificationCount();
      if (result.success) {
        await syncAppBadge(result.data ?? 0);
      }
    } catch {
      // Offline or signed out: keep the last badge.
    }
  }, [enabled]);

  React.useEffect(() => {
    if (!enabled) return;
    void refresh();
    const handleChanged = () => {
      void refresh();
    };
    window.addEventListener(NOTIFICATIONS_CHANGED_EVENT, handleChanged);
    return () => window.removeEventListener(NOTIFICATIONS_CHANGED_EVENT, handleChanged);
  }, [enabled, refresh]);

  useVisibleRefresh(refresh, POLL_INTERVAL_MS);

  return null;
};
