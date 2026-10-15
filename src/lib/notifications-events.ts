/**
 * Fired on `window` when notifications were marked read outside the bell (a
 * push tap that opened `?notification=<id>`, ZIG-I21-2) or by the bell itself,
 * so the bell count and the app icon badge refresh without waiting for focus.
 */
export const NOTIFICATIONS_CHANGED_EVENT = 'zigzag:notifications-changed';

export const announceNotificationsChanged = (): void => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED_EVENT));
};
