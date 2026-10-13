'use client';

import * as React from 'react';
import {
  isPwaInstallBannerDismissed,
  persistPwaInstallBannerDismiss,
} from '@/lib/pwa-install-persistence';
import { useDisplayModeStandalone } from '@/hooks/use-display-mode-standalone';
import {
  getPwaInstallServerSnapshot,
  getPwaInstallSnapshot,
  promptPwaInstall,
  subscribePwaInstall,
  type PwaInstallOutcome,
} from '@/lib/pwa-install-store';
import type { PwaInstallSurface } from '@/lib/client-analytics';

export type UsePwaInstallPromptResult = {
  canPrompt: boolean;
  isInstalling: boolean;
  promptInstall: () => Promise<PwaInstallOutcome>;
  dismiss: () => void;
};

type UsePwaInstallPromptOptions = {
  /** Where the prompt is offered, for the install funnel (ZIG-I21-4). */
  surface?: PwaInstallSurface;
  /**
   * The banner hides for 30 days after "cerrar"; the Mi cuenta card is the
   * permanent place to install, so it ignores that snooze.
   */
  respectBannerDismissal?: boolean;
};

export const usePwaInstallPrompt = ({
  surface = 'banner',
  respectBannerDismissal = true,
}: UsePwaInstallPromptOptions = {}): UsePwaInstallPromptResult => {
  const isStandalone = useDisplayModeStandalone();
  const { available } = React.useSyncExternalStore(
    subscribePwaInstall,
    getPwaInstallSnapshot,
    getPwaInstallServerSnapshot,
  );
  const [dismissed, setDismissed] = React.useState(
    () => respectBannerDismissal && isPwaInstallBannerDismissed(),
  );
  const [isInstalling, setIsInstalling] = React.useState(false);

  const promptInstall = React.useCallback(async () => {
    setIsInstalling(true);
    try {
      return await promptPwaInstall(surface);
    } finally {
      setIsInstalling(false);
    }
  }, [surface]);

  const dismiss = React.useCallback(() => {
    persistPwaInstallBannerDismiss();
    setDismissed(true);
  }, []);

  return {
    canPrompt: available && !isStandalone && !(respectBannerDismissal && dismissed),
    isInstalling,
    promptInstall,
    dismiss,
  };
};
