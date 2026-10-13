'use client';

import * as React from 'react';
import { usePathname } from 'next/navigation';

import { markNotificationRead } from '@/actions/notifications';
import { announceNotificationsChanged } from '@/lib/notifications-events';
import { NOTIFICATION_QUERY_PARAM } from '@/lib/push/display';

/**
 * A push tap or action button opens its page with `?notification=<id>`
 * (ZIG-I21-2). Mark that notification read, then drop the parameter from the
 * address bar so a reload or a shared link does not carry it. The service
 * worker never touches the database; the page does it with the user's session.
 */
export const NotificationReadFromUrl = () => {
  const pathname = usePathname();

  React.useEffect(() => {
    const url = new URL(window.location.href);
    const raw = url.searchParams.get(NOTIFICATION_QUERY_PARAM);
    if (raw === null) return;

    url.searchParams.delete(NOTIFICATION_QUERY_PARAM);
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);

    const id = Number(raw);
    if (!Number.isSafeInteger(id) || id <= 0) return;
    void markNotificationRead(id)
      .then((result) => {
        if (result.success) announceNotificationsChanged();
      })
      .catch(() => {
        // Best effort: the bell still shows it unread and can mark it there.
      });
  }, [pathname]);

  return null;
};
