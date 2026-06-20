'use client';

import { AlertTriangle } from 'lucide-react';
import { TripledRetryButton, TripledRouteState } from '@/components/tripled';

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
      action={<TripledRetryButton onRetry={reset} />}
    />
  );
}
