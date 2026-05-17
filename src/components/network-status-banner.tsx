'use client';

import { useEffect, useState } from 'react';
import { Wifi, WifiOff } from 'lucide-react';
import { useNetworkStatus } from '@/hooks/use-network-status';

/** Visible banner row height (py-2 + text-sm line); used with safe-area for layout offset. */
const BANNER_ROW_HEIGHT = '2.5rem';

const bannerShellClassName =
  'fixed left-0 right-0 top-0 z-50 border-b px-4 py-2 text-sm pt-[env(safe-area-inset-top,0px)]';

export function NetworkStatusBanner() {
  const { isOnline } = useNetworkStatus();
  const [showRecovered, setShowRecovered] = useState(false);
  const [hasBeenOffline, setHasBeenOffline] = useState(false);

  const isVisible = !isOnline || showRecovered;

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

  // Push document flow down so fixed banner does not cover TripledPageHeader / main content.
  useEffect(() => {
    const root = document.documentElement;
    if (isVisible) {
      root.style.setProperty(
        '--network-status-banner-offset',
        `calc(${BANNER_ROW_HEIGHT} + env(safe-area-inset-top, 0px))`,
      );
    } else {
      root.style.removeProperty('--network-status-banner-offset');
    }
    return () => {
      root.style.removeProperty('--network-status-banner-offset');
    };
  }, [isVisible]);

  if (!isOnline) {
    return (
      <div
        role="status"
        aria-live="assertive"
        className={`${bannerShellClassName} border-amber-300 bg-amber-100 text-amber-900`}
      >
        <div className="mx-auto flex max-w-7xl items-center gap-2">
          <WifiOff className="h-4 w-4 shrink-0" aria-hidden="true" />
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
        className={`${bannerShellClassName} border-emerald-300 bg-emerald-100 text-emerald-900`}
      >
        <div className="mx-auto flex max-w-7xl items-center gap-2">
          <Wifi className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>Conexión restablecida.</span>
        </div>
      </div>
    );
  }

  return null;
}
