import { act, fireEvent, render, screen } from '@testing-library/react';

import { PwaInstallCard } from '@/components/account/pwa-install-card';
import { persistPwaInstallBannerDismiss, clearPwaInstallBannerDismiss } from '@/lib/pwa-install-persistence';
import { resetPwaInstallStoreForTests } from '@/lib/pwa-install-store';

let standalone = false;
jest.mock('@/hooks/use-display-mode-standalone', () => ({
  useDisplayModeStandalone: () => standalone,
}));
jest.mock('@/actions/push-subscriptions', () => ({}));
jest.mock('sonner', () => ({ toast: { success: jest.fn() } }));
jest.mock('@/lib/client-analytics', () => ({
  ...jest.requireActual('@/lib/client-analytics'),
  trackClientEvent: jest.fn(),
}));

const { trackClientEvent } = jest.requireMock<{ trackClientEvent: jest.Mock }>(
  '@/lib/client-analytics',
);

const ANDROID_UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/129.0 Mobile Safari/537.36';
const IPHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148';
const DESKTOP_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/129.0 Safari/537.36';

const setUserAgent = (value: string) => {
  Object.defineProperty(window.navigator, 'userAgent', { value, configurable: true });
};

const offerInstall = (outcome: 'accepted' | 'dismissed' = 'accepted') => {
  const event = new Event('beforeinstallprompt') as Event & {
    prompt: jest.Mock;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
  };
  event.prompt = jest.fn().mockResolvedValue(undefined);
  event.userChoice = Promise.resolve({ outcome });
  act(() => {
    window.dispatchEvent(event);
  });
  return event;
};

describe('PwaInstallCard (ZIG-I21-4)', () => {
  const originalUa = window.navigator.userAgent;

  beforeEach(() => {
    jest.clearAllMocks();
    standalone = false;
    resetPwaInstallStoreForTests();
    clearPwaInstallBannerDismiss();
  });

  afterAll(() => setUserAgent(originalUa));

  it('offers one-tap install on Android, even after the banner was closed', async () => {
    setUserAgent(ANDROID_UA);
    persistPwaInstallBannerDismiss();
    render(<PwaInstallCard />);
    expect(screen.queryByTestId('pwa-install-card')).not.toBeInTheDocument();

    const event = offerInstall();
    expect(screen.getByTestId('pwa-install-button')).toHaveTextContent('Instalar ZigZag');
    expect(trackClientEvent).toHaveBeenCalledWith('pwa_install_prompt', { surface: 'account' });

    await act(async () => {
      fireEvent.click(screen.getByTestId('pwa-install-button'));
    });
    expect(event.prompt).toHaveBeenCalledTimes(1);
    expect(trackClientEvent).toHaveBeenCalledWith('pwa_install_accepted', { surface: 'account' });
    expect(screen.queryByTestId('pwa-install-card')).not.toBeInTheDocument();
  });

  it('is hidden in the installed app', () => {
    setUserAgent(ANDROID_UA);
    standalone = true;
    render(<PwaInstallCard />);
    offerInstall();
    expect(screen.queryByTestId('pwa-install-card')).not.toBeInTheDocument();
  });

  it('is hidden on desktop even when Chrome offers an install', () => {
    setUserAgent(DESKTOP_UA);
    render(<PwaInstallCard />);
    offerInstall();
    expect(screen.queryByTestId('pwa-install-card')).not.toBeInTheDocument();
    expect(trackClientEvent).not.toHaveBeenCalled();
  });

  it('explains Agregar a inicio on iPhone', () => {
    setUserAgent(IPHONE_UA);
    render(<PwaInstallCard />);
    expect(screen.getByTestId('pwa-install-ios-steps')).toHaveTextContent('Agregar a inicio');
    expect(screen.queryByTestId('pwa-install-button')).not.toBeInTheDocument();
  });

  it('stays hidden on Android until Chrome offers the install', () => {
    setUserAgent(ANDROID_UA);
    render(<PwaInstallCard />);
    expect(screen.queryByTestId('pwa-install-card')).not.toBeInTheDocument();
  });
});
