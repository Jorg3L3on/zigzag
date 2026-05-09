'use client';

import { useEffect, useState } from 'react';
import { getIsOnline } from '@/lib/network-awareness';

export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState<boolean>(() => getIsOnline());

  useEffect(() => {
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
