import {
  clearPwaInstallBannerDismiss,
  isPwaInstallBannerDismissed,
  persistPwaInstallBannerDismiss,
} from '@/lib/pwa-install-persistence';

describe('pwa install persistence', () => {
  beforeEach(() => {
    clearPwaInstallBannerDismiss();
  });

  it('starts undismissed', () => {
    expect(isPwaInstallBannerDismissed()).toBe(false);
  });

  it('persists dismiss timestamps', () => {
    persistPwaInstallBannerDismiss();
    expect(isPwaInstallBannerDismissed()).toBe(true);
  });

  it('clears dismiss state', () => {
    persistPwaInstallBannerDismiss();
    clearPwaInstallBannerDismiss();
    expect(isPwaInstallBannerDismissed()).toBe(false);
  });
});
