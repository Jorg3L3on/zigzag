/**
 * Badging API helpers (ZIG-I21-3): the unread count on the installed app's
 * icon. Supported by Android Chrome and iOS 16.4+ home-screen apps; every
 * other browser skips it silently.
 */
type BadgingNavigator = Navigator & {
  setAppBadge?: (contents?: number) => Promise<void>;
  clearAppBadge?: () => Promise<void>;
};

const badgingNavigator = (): BadgingNavigator | null =>
  typeof navigator === 'undefined' ? null : (navigator as BadgingNavigator);

export const supportsAppBadge = (): boolean => {
  const nav = badgingNavigator();
  return typeof nav?.setAppBadge === 'function' && typeof nav.clearAppBadge === 'function';
};

/** Show `count` on the app icon, or clear it at zero. Never throws. */
export const syncAppBadge = async (count: number): Promise<void> => {
  const nav = badgingNavigator();
  if (!nav || !supportsAppBadge()) return;
  try {
    if (count > 0) {
      await nav.setAppBadge!(count);
    } else {
      await nav.clearAppBadge!();
    }
  } catch {
    // Permission or platform refusal: the bell still shows the count.
  }
};
