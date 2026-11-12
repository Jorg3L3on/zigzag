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

/**
 * Set by DesktopSwitch around each of its two trees, so everything inside a tree
 * renders for that layout even on the server, where the width is unknown (ZIG-28).
 */
export const DesktopLayoutContext = React.createContext<boolean | null>(null);

/**
 * True from 1024px. Inside a DesktopSwitch tree, that tree's layout; elsewhere false
 * on the server and on phones (mobile stays the default).
 */
export const useIsDesktop = () => {
  const layout = React.useContext(DesktopLayoutContext);
  const matches = React.useSyncExternalStore(
    subscribeToDesktopQuery,
    getDesktopSnapshot,
    () => false,
  );
  return layout ?? matches;
};

/**
 * Null while the width is unknown (server render and hydration), then whether the
 * desktop layout owns the viewport. A client-side navigation knows it at once.
 */
export const useDesktopViewport = (): boolean | null =>
  React.useSyncExternalStore(subscribeToDesktopQuery, getDesktopSnapshot, () => null);
