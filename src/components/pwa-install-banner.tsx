'use client';

import * as React from 'react';
import { Download, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePwaInstallPrompt } from '@/hooks/use-pwa-install-prompt';
import { cn } from '@/lib/utils';

export const PwaInstallBanner = () => {
  const { canPrompt, isInstalling, promptInstall, dismiss } =
    usePwaInstallPrompt();

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

  if (!canPrompt) {
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
