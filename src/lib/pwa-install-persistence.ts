const DISMISS_KEY = 'zigzag:pwa-install-banner:dismissed';
const SNOOZE_DAYS = 30;

const canUseLocalStorage = (): boolean => {
  if (typeof window === 'undefined') {
    return false;
  }
  try {
    const probe = '__zigzag_pwa_install_probe__';
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
    return true;
  } catch {
    return false;
  }
};

export const isPwaInstallBannerDismissed = (): boolean => {
  if (!canUseLocalStorage()) {
    return false;
  }

  const raw = window.localStorage.getItem(DISMISS_KEY);
  if (!raw) {
    return false;
  }

  const dismissedAt = Date.parse(raw);
  if (Number.isNaN(dismissedAt)) {
    return true;
  }

  const snoozeMs = SNOOZE_DAYS * 24 * 60 * 60 * 1000;
  return Date.now() - dismissedAt < snoozeMs;
};

export const persistPwaInstallBannerDismiss = (): void => {
  if (!canUseLocalStorage()) {
    return;
  }
  window.localStorage.setItem(DISMISS_KEY, new Date().toISOString());
};

export const clearPwaInstallBannerDismiss = (): void => {
  if (!canUseLocalStorage()) {
    return;
  }
  window.localStorage.removeItem(DISMISS_KEY);
};
