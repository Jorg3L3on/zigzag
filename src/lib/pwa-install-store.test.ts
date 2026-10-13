import {
  getPwaInstallSnapshot,
  promptPwaInstall,
  resetPwaInstallStoreForTests,
  subscribePwaInstall,
} from '@/lib/pwa-install-store';
import {
  clearPwaInstallBannerDismiss,
  isPwaInstallBannerDismissed,
} from '@/lib/pwa-install-persistence';

jest.mock('@/lib/client-analytics', () => ({
  ...jest.requireActual('@/lib/client-analytics'),
  trackClientEvent: jest.fn(),
}));

const { trackClientEvent } = jest.requireMock<{ trackClientEvent: jest.Mock }>(
  '@/lib/client-analytics',
);

const fireBeforeInstallPrompt = (outcome: 'accepted' | 'dismissed') => {
  const event = new Event('beforeinstallprompt') as Event & {
    prompt: jest.Mock;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
  };
  event.prompt = jest.fn().mockResolvedValue(undefined);
  event.userChoice = Promise.resolve({ outcome });
  window.dispatchEvent(event);
  return event;
};

describe('PWA install store (ZIG-I21-4)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetPwaInstallStoreForTests();
    clearPwaInstallBannerDismiss();
  });

  it('keeps the event that fired before any surface mounted', () => {
    fireBeforeInstallPrompt('accepted');
    const listener = jest.fn();
    subscribePwaInstall(listener);
    expect(getPwaInstallSnapshot()).toEqual({ available: true });
  });

  it('records an accepted install with its surface and hides every surface', async () => {
    const event = fireBeforeInstallPrompt('accepted');
    await expect(promptPwaInstall('account')).resolves.toBe('accepted');
    expect(event.prompt).toHaveBeenCalledTimes(1);
    expect(trackClientEvent).toHaveBeenCalledWith('pwa_install_accepted', { surface: 'account' });
    expect(getPwaInstallSnapshot()).toEqual({ available: false });
    expect(isPwaInstallBannerDismissed()).toBe(true);
  });

  it('records a dismissed dialog', async () => {
    fireBeforeInstallPrompt('dismissed');
    await expect(promptPwaInstall('banner')).resolves.toBe('dismissed');
    expect(trackClientEvent).toHaveBeenCalledWith('pwa_install_dismissed', { surface: 'banner' });
    expect(isPwaInstallBannerDismissed()).toBe(false);
  });

  it('reports unavailable when Chrome has not offered an install', async () => {
    await expect(promptPwaInstall('account')).resolves.toBe('unavailable');
    expect(trackClientEvent).not.toHaveBeenCalled();
  });

  it('records pwa_installed when the app is installed from any entry point', () => {
    fireBeforeInstallPrompt('accepted');
    window.dispatchEvent(new Event('appinstalled'));
    expect(trackClientEvent).toHaveBeenCalledWith('pwa_installed');
    expect(getPwaInstallSnapshot()).toEqual({ available: false });
  });
});
