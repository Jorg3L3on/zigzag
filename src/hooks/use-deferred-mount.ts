'use client';

import * as React from 'react';

/**
 * Defers rendering until after first paint (idle callback or timeout fallback).
 */
export const useDeferredMount = (fallbackDelayMs = 0): boolean => {
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    if (typeof window.requestIdleCallback === 'function') {
      const handle = window.requestIdleCallback(() => setMounted(true), {
        timeout: 2000,
      });
      return () => window.cancelIdleCallback(handle);
    }

    const timeoutId = window.setTimeout(() => setMounted(true), fallbackDelayMs);
    return () => window.clearTimeout(timeoutId);
  }, [fallbackDelayMs]);

  return mounted;
};
