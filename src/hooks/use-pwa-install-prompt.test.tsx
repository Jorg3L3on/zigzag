/** @jest-environment jsdom */

import { renderHook, act } from '@testing-library/react';
import { usePwaInstallPrompt } from '@/hooks/use-pwa-install-prompt';
import { clearPwaInstallBannerDismiss } from '@/lib/pwa-install-persistence';

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
