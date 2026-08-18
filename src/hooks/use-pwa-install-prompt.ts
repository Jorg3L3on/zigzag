'use client';

import * as React from 'react';
import {
  isPwaInstallBannerDismissed,
  persistPwaInstallBannerDismiss,
} from '@/lib/pwa-install-persistence';
import { useDisplayModeStandalone } from '@/hooks/use-display-mode-standalone';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

export type UsePwaInstallPromptResult = {
  canPrompt: boolean;
  isInstalling: boolean;
  promptInstall: () => Promise<'accepted' | 'dismissed' | 'unavailable'>;
  dismiss: () => void;
};

export const usePwaInstallPrompt = (): UsePwaInstallPromptResult => {
  const isStandalone = useDisplayModeStandalone();
  const deferredRef = React.useRef<BeforeInstallPromptEvent | null>(null);
  const [canPrompt, setCanPrompt] = React.useState(false);
  const [isInstalling, setIsInstalling] = React.useState(false);

  React.useEffect(() => {
    if (isStandalone || isPwaInstallBannerDismissed()) {
      return;
    }

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      deferredRef.current = event as BeforeInstallPromptEvent;
      setCanPrompt(true);
    };

    const handleAppInstalled = () => {
      persistPwaInstallBannerDismiss();
      deferredRef.current = null;
      setCanPrompt(false);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener(
        'beforeinstallprompt',
        handleBeforeInstallPrompt,
      );
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, [isStandalone]);

  const promptInstall = React.useCallback(async () => {
    const deferred = deferredRef.current;
    if (!deferred) {
      return 'unavailable';
    }

    setIsInstalling(true);
    try {
      await deferred.prompt();
      const choice = await deferred.userChoice;
      if (choice.outcome === 'accepted') {
        persistPwaInstallBannerDismiss();
        setCanPrompt(false);
      }
      return choice.outcome;
    } finally {
      setIsInstalling(false);
    }
  }, []);

  const dismiss = React.useCallback(() => {
    persistPwaInstallBannerDismiss();
    setCanPrompt(false);
  }, []);

  return {
    canPrompt: canPrompt && !isStandalone,
    isInstalling,
    promptInstall,
    dismiss,
  };
};
