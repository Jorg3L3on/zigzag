'use client';

import { AlertTriangle, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TripledRouteState } from '@/components/tripled';

export default function DashboardError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <TripledRouteState
      title="No se pudo cargar la sección"
      description="Ocurrió un problema inesperado. Intenta de nuevo o vuelve al dashboard."
      icon={<AlertTriangle className="h-5 w-5" aria-hidden />}
      action={
        <Button type="button" onClick={reset}>
          <RotateCcw
            className="mr-2 h-4 w-4"
            aria-hidden
            data-icon="inline-start"
          />
          Reintentar
        </Button>
      }
    />
  );
}
