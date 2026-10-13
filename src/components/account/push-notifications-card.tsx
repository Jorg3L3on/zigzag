'use client';

import * as React from 'react';
import { BellRing, Smartphone } from 'lucide-react';
import { toast } from 'sonner';

import { hasPushSubscription } from '@/actions/push-subscriptions';
import { Button } from '@/components/ui/button';
import { useDisplayModeStandalone } from '@/hooks/use-display-mode-standalone';
import {
  detectPushSupport,
  disablePushOnThisDevice,
  enablePushOnThisDevice,
  getCurrentPushSubscription,
  type PushSupport,
} from '@/lib/push-client';

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

type State = 'loading' | 'off' | 'on';

/**
 * Mi cuenta › Avisos en este teléfono (ZIG-I20-2). One tap turns Web Push on
 * for this device; iOS only delivers push to the app on the home screen, so
 * the card explains that instead of offering a button that does nothing.
 */
export const PushNotificationsCard = () => {
  const isStandalone = useDisplayModeStandalone();
  const [support, setSupport] = React.useState<PushSupport | null>(null);
  const [state, setState] = React.useState<State>('loading');
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    const detected = detectPushSupport(isStandalone);
    setSupport(detected);
    if (detected !== 'ready') {
      setState('off');
      return;
    }
    void (async () => {
      try {
        const subscription = await getCurrentPushSubscription();
        if (!subscription) {
          if (!cancelled) setState('off');
          return;
        }
        const known = await hasPushSubscription(subscription.endpoint);
        if (!cancelled) setState(known.success && known.data ? 'on' : 'off');
      } catch {
        if (!cancelled) setState('off');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isStandalone]);

  if (!VAPID_PUBLIC_KEY || support === null) return null;

  const enable = async () => {
    setBusy(true);
    try {
      const result = await enablePushOnThisDevice(VAPID_PUBLIC_KEY);
      if (result === 'enabled') {
        setState('on');
        toast.success('Avisos activados en este dispositivo');
      } else if (result === 'denied') {
        setSupport('denied');
        toast.error('El navegador no dio permiso para avisos');
      } else if (result === 'no-service-worker') {
        toast.error('Abre la app instalada para activar los avisos');
      } else {
        toast.error('No se pudieron activar los avisos. Intenta de nuevo.');
      }
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    setBusy(true);
    try {
      await disablePushOnThisDevice();
      setState('off');
      toast.success('Avisos apagados en este dispositivo');
    } finally {
      setBusy(false);
    }
  };

  let body: React.ReactNode;
  if (support === 'ios-needs-install') {
    body = (
      <p className="text-sm text-muted-foreground" data-testid="push-ios-hint">
        En iPhone los avisos solo llegan con la app en la pantalla de inicio.
        Sigue los pasos de <strong>Instalar ZigZag</strong>, abre la app desde
        tu pantalla de inicio y vuelve aquí para activarlos.
      </p>
    );
  } else if (support === 'unsupported') {
    body = (
      <p className="text-sm text-muted-foreground">
        Este navegador no puede recibir avisos. Instala la app para tenerlos.
      </p>
    );
  } else if (support === 'denied') {
    body = (
      <p className="text-sm text-muted-foreground">
        El navegador tiene los avisos bloqueados para ZigZag. Permítelos en los
        ajustes del sitio y vuelve a intentar.
      </p>
    );
  } else {
    body = (
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-sm text-muted-foreground">
          {state === 'on'
            ? 'Este dispositivo recibe avisos de mantenimientos próximos y atrasados, el resumen diario y exportaciones listas.'
            : 'Recibe en este dispositivo los avisos de mantenimientos próximos y atrasados, el resumen diario y exportaciones listas, sin abrir la app.'}
        </p>
        <Button
          type="button"
          variant={state === 'on' ? 'outline' : 'default'}
          className="min-h-11"
          disabled={busy || state === 'loading'}
          onClick={state === 'on' ? disable : enable}
          data-testid="push-toggle"
        >
          <BellRing className="size-4" aria-hidden />
          {state === 'loading' ? 'Revisando…' : state === 'on' ? 'Apagar avisos aquí' : 'Activar avisos aquí'}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2 border-t border-border/60 pt-4" data-testid="push-notifications-card">
      <h3 className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <Smartphone className="size-4" aria-hidden />
        Avisos en este dispositivo
      </h3>
      {body}
    </div>
  );
};
