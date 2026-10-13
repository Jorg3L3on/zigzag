/** @jest-environment jsdom */

import { renderHook, act } from '@testing-library/react';
import { usePwaInstallPrompt } from '@/hooks/use-pwa-install-prompt';
import {
  clearPwaInstallBannerDismiss,
  persistPwaInstallBannerDismiss,
} from '@/lib/pwa-install-persistence';
import { resetPwaInstallStoreForTests } from '@/lib/pwa-install-store';

jest.mock('@/hooks/use-display-mode-standalone', () => ({
  useDisplayModeStandalone: () => false,
}));

describe('usePwaInstallPrompt', () => {
  beforeEach(() => {
    clearPwaInstallBannerDismiss();
  });

  it('stores deferred install events', () => {
    const { result } = renderHook(() => usePwaInstallPrompt());

    act(() => {
      const event = new Event('beforeinstallprompt') as Event & {
        preventDefault: () => void;
        prompt: () => Promise<void>;
        userChoice: Promise<{ outcome: 'accepted' }>;
      };
      event.preventDefault = jest.fn();
      event.prompt = jest.fn().mockResolvedValue(undefined);
      event.userChoice = Promise.resolve({ outcome: 'accepted' });
      window.dispatchEvent(event);
    });

    expect(result.current.canPrompt).toBe(true);
  });
});

describe('usePwaInstallPrompt banner snooze (ZIG-I21-4)', () => {
  beforeEach(() => {
    resetPwaInstallStoreForTests();
    persistPwaInstallBannerDismiss();
  });

  afterEach(() => clearPwaInstallBannerDismiss());

  const fire = () => {
    const event = new Event('beforeinstallprompt') as Event & {
      prompt: () => Promise<void>;
      userChoice: Promise<{ outcome: 'accepted' }>;
    };
    event.prompt = jest.fn().mockResolvedValue(undefined);
    event.userChoice = Promise.resolve({ outcome: 'accepted' });
    window.dispatchEvent(event);
  };

  it('the banner respects the 30-day snooze; Mi cuenta does not', () => {
    const banner = renderHook(() => usePwaInstallPrompt());
    const account = renderHook(() =>
      usePwaInstallPrompt({ surface: 'account', respectBannerDismissal: false }),
    );
    act(fire);
    expect(banner.result.current.canPrompt).toBe(false);
    expect(account.result.current.canPrompt).toBe(true);
  });
});
