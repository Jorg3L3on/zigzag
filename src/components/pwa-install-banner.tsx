'use client';

import * as React from 'react';
import { Download, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePwaInstallPrompt } from '@/hooks/use-pwa-install-prompt';
import { PWA_INSTALL_EVENTS, trackClientEvent } from '@/lib/client-analytics';
import { cn } from '@/lib/utils';

const INTERACTION_EVENTS = ['pointerdown', 'keydown', 'scroll'] as const;

/**
 * True after the first tap, key or scroll. The banner's text is larger than the
 * dashboard greeting, so showing it on load made it the page's LCP element;
 * the browser stops LCP at the first interaction, so waiting keeps it out.
 */
const useHasInteracted = (): boolean => {
  const [hasInteracted, setHasInteracted] = React.useState(false);

  React.useEffect(() => {
    if (hasInteracted) {
      return;
    }
    const handleInteraction = () => setHasInteracted(true);
    for (const eventName of INTERACTION_EVENTS) {
      window.addEventListener(eventName, handleInteraction, {
        once: true,
        passive: true,
        capture: true,
      });
    }
    return () => {
      for (const eventName of INTERACTION_EVENTS) {
        window.removeEventListener(eventName, handleInteraction, {
          capture: true,
        });
      }
    };
  }, [hasInteracted]);

  return hasInteracted;
};

export const PwaInstallBanner = () => {
  const { canPrompt, isInstalling, promptInstall, dismiss } =
    usePwaInstallPrompt();
  const hasInteracted = useHasInteracted();
  const visible = canPrompt && hasInteracted;

  React.useEffect(() => {
    if (visible) {
      trackClientEvent(PWA_INSTALL_EVENTS.prompt, { surface: 'banner' });
    }
  }, [visible]);

  const handleInstall = React.useCallback(async () => {
    await promptInstall();
  }, [promptInstall]);

  const handleInstallKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLButtonElement>) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        void handleInstall();
      }
    },
    [handleInstall],
  );

  const handleDismissKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLButtonElement>) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        dismiss();
      }
    },
    [dismiss],
  );

  if (!visible) {
    return null;
  }

  return (
    <div
      role="region"
      aria-label="Instalar aplicación ZigZag"
      data-testid="pwa-install-banner"
      className={cn(
        'fixed inset-x-0 z-50 border-b border-primary/20 bg-primary/10 px-4 py-2 backdrop-blur',
        'top-[var(--network-status-banner-offset,0px)]',
      )}
      style={{
        // Stack install hint below offline banner when both are visible.
        marginTop: 'var(--pwa-install-banner-stack, 0px)',
      }}
    >
      <div className="mx-auto flex max-w-6xl items-center gap-3">
        <Download className="h-5 w-5 shrink-0 text-primary" aria-hidden />
        <p className="min-w-0 flex-1 text-sm text-foreground">
          Instala ZigZag para acceso rápido desde tu pantalla de inicio.
        </p>
        <Button
          type="button"
          size="sm"
          className="h-11 shrink-0 px-4"
          disabled={isInstalling}
          aria-label="Instalar ZigZag"
          tabIndex={0}
          onClick={() => {
            void handleInstall();
          }}
          onKeyDown={handleInstallKeyDown}
        >
          {isInstalling ? 'Instalando…' : 'Instalar'}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-11 w-11 shrink-0"
          aria-label="Cerrar aviso de instalación"
          tabIndex={0}
          onClick={dismiss}
          onKeyDown={handleDismissKeyDown}
        >
          <X className="h-5 w-5" aria-hidden />
        </Button>
      </div>
    </div>
  );
};
