'use client';

import { useEffect, useState } from 'react';
import { getIsOnline } from '@/lib/network-awareness';

export function useNetworkStatus() {
  // Assume online until mount so the first client render matches SSR (navigator is unavailable there).
  const [isOnline, setIsOnline] = useState<boolean>(true);

  useEffect(() => {
    setIsOnline(getIsOnline());

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return { isOnline };
}
