import * as React from 'react';

import { DESKTOP_BREAKPOINT_PX } from '@/lib/breakpoints';

// Tailwind `lg` breakpoint (1024px)
const DESKTOP_MEDIA_QUERY = `(min-width: ${DESKTOP_BREAKPOINT_PX}px)`;

const getDesktopMediaQueryList = () => {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return null;
  }
  return window.matchMedia(DESKTOP_MEDIA_QUERY);
};

const subscribeToDesktopQuery = (onStoreChange: () => void) => {
  const mediaQueryList = getDesktopMediaQueryList();
  if (!mediaQueryList) return () => undefined;
  mediaQueryList.addEventListener('change', onStoreChange);
  return () => mediaQueryList.removeEventListener('change', onStoreChange);
};

const getDesktopSnapshot = () => getDesktopMediaQueryList()?.matches ?? false;

/** True from 1024px; false on the server and on phones (mobile stays the default). */
export const useIsDesktop = () =>
  React.useSyncExternalStore(subscribeToDesktopQuery, getDesktopSnapshot, () => false);
