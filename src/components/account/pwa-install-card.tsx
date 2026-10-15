'use client';

import * as React from 'react';
import { Download } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { useDisplayModeStandalone } from '@/hooks/use-display-mode-standalone';
import { usePwaInstallPrompt } from '@/hooks/use-pwa-install-prompt';
import { PWA_INSTALL_EVENTS, trackClientEvent } from '@/lib/client-analytics';
import { isAndroidDevice, isIosDevice } from '@/lib/push-client';

type Platform = 'android' | 'ios' | 'other';

const detectPlatform = (): Platform => {
  if (typeof navigator === 'undefined') return 'other';
  if (isIosDevice(navigator.userAgent, navigator.maxTouchPoints)) return 'ios';
  if (isAndroidDevice(navigator.userAgent)) return 'android';
  return 'other';
};

/**
 * Mi cuenta › Instalar ZigZag (ZIG-I21-4), next to the push card. On Android
 * it opens Chrome's install dialog in one tap (even after the banner was
 * closed); on iPhone it explains Agregar a inicio, which is also what push
 * needs there. Hidden in the installed app and on desktop.
 */
export const PwaInstallCard = () => {
  const isStandalone = useDisplayModeStandalone();
  const { canPrompt, isInstalling, promptInstall } = usePwaInstallPrompt({
    surface: 'account',
    respectBannerDismissal: false,
  });
  const [platform, setPlatform] = React.useState<Platform | null>(null);

  React.useEffect(() => {
    setPlatform(detectPlatform());
  }, []);

  const showAndroid = platform === 'android' && canPrompt;
  const showIos = platform === 'ios' && !isStandalone;

  React.useEffect(() => {
    if (showAndroid) {
      trackClientEvent(PWA_INSTALL_EVENTS.prompt, { surface: 'account' });
    }
  }, [showAndroid]);

  if (isStandalone || (!showAndroid && !showIos)) return null;

  const install = async () => {
    const outcome = await promptInstall();
    if (outcome === 'accepted') {
      toast.success('ZigZag se está instalando en tu pantalla de inicio');
    }
  };

  return (
    <div className="space-y-2 border-t border-border/60 pt-4" data-testid="pwa-install-card">
      <h3 className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <Download className="size-4" aria-hidden />
        Instalar ZigZag
      </h3>
      {showAndroid ? (
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm text-muted-foreground">
            Abre ZigZag desde un ícono en tu pantalla de inicio, a pantalla
            completa y sin la barra del navegador, y recibe los avisos aunque la
            app esté cerrada.
          </p>
          <Button
            type="button"
            className="min-h-11"
            disabled={isInstalling}
            onClick={() => {
              void install();
            }}
            data-testid="pwa-install-button"
          >
            <Download className="size-4" aria-hidden />
            {isInstalling ? 'Instalando…' : 'Instalar ZigZag'}
          </Button>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground" data-testid="pwa-install-ios-steps">
          En iPhone la app y sus avisos viven en la pantalla de inicio: en
          Safari toca Compartir y luego <strong>Agregar a inicio</strong>, abre
          ZigZag desde ahí y vuelve aquí.
        </p>
      )}
    </div>
  );
};
