'use client';

import { useEffect, useState } from 'react';
import { Wifi, WifiOff } from 'lucide-react';
import { useNetworkStatus } from '@/hooks/use-network-status';

export function NetworkStatusBanner() {
  const { isOnline } = useNetworkStatus();
  const [showRecovered, setShowRecovered] = useState(false);
  const [hasBeenOffline, setHasBeenOffline] = useState(false);

  useEffect(() => {
    if (!isOnline) {
      setHasBeenOffline(true);
      setShowRecovered(false);
      return;
    }

    if (!hasBeenOffline) {
      return;
    }

    setShowRecovered(true);
    const timeout = setTimeout(() => {
      setShowRecovered(false);
    }, 4000);

    return () => clearTimeout(timeout);
  }, [isOnline, hasBeenOffline]);

  if (!isOnline) {
    return (
      <div
        role="status"
        aria-live="assertive"
        className="fixed left-0 right-0 top-0 z-50 border-b border-amber-300 bg-amber-100 px-4 py-2 text-sm text-amber-900"
      >
        <div className="mx-auto flex max-w-7xl items-center gap-2">
          <WifiOff className="h-4 w-4" aria-hidden="true" />
          <span>Sin conexión a internet. Algunas acciones pueden fallar.</span>
        </div>
      </div>
    );
  }

  if (showRecovered) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="fixed left-0 right-0 top-0 z-50 border-b border-emerald-300 bg-emerald-100 px-4 py-2 text-sm text-emerald-900"
      >
        <div className="mx-auto flex max-w-7xl items-center gap-2">
          <Wifi className="h-4 w-4" aria-hidden="true" />
          <span>Conexión restablecida.</span>
        </div>
      </div>
    );
  }

  return null;
}
