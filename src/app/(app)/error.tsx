'use client';

import * as React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TripledRouteState } from '@/components/tripled';
import {
  CHUNK_RELOAD_SESSION_KEY,
  isChunkLoadError,
} from '@/lib/chunk-load-error';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const chunkLoadFailure = isChunkLoadError(error);

  React.useEffect(() => {
    if (!chunkLoadFailure) {
      return;
    }

    try {
      if (window.sessionStorage.getItem(CHUNK_RELOAD_SESSION_KEY) === '1') {
        return;
      }
      window.sessionStorage.setItem(CHUNK_RELOAD_SESSION_KEY, '1');
    } catch {
      // sessionStorage unavailable — still attempt one hard reload.
    }

    window.location.reload();
  }, [chunkLoadFailure]);

  const handleRetry = () => {
    if (chunkLoadFailure) {
      try {
        window.sessionStorage.removeItem(CHUNK_RELOAD_SESSION_KEY);
      } catch {
        // Ignore unavailable sessionStorage.
      }
      window.location.reload();
      return;
    }

    reset();
  };

  return (
    <TripledRouteState
      title="No se pudo cargar la sección"
      description={
        chunkLoadFailure
          ? 'Hay una versión nueva de la app. Recarga para continuar.'
          : 'Ocurrió un problema inesperado. Intenta de nuevo o vuelve al dashboard.'
      }
      icon={<AlertTriangle className="h-5 w-5" aria-hidden />}
      action={
        <Button type="button" onClick={handleRetry}>
          <RotateCcw
            className="mr-2 h-4 w-4"
            aria-hidden
            data-icon="inline-start"
          />
          {chunkLoadFailure ? 'Recargar app' : 'Reintentar'}
        </Button>
      }
    />
  );
}
