import * as React from 'react';

const DISPLAY_MODE_STANDALONE_QUERY = '(display-mode: standalone)';

function getDisplayModeMediaQueryList() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return null;
  }
  return window.matchMedia(DISPLAY_MODE_STANDALONE_QUERY);
}

function getStandaloneSnapshot() {
  const isStandaloneDisplayMode =
    getDisplayModeMediaQueryList()?.matches ?? false;
  const maybeStandaloneNavigator =
    typeof navigator === 'undefined'
      ? null
      : (navigator as Navigator & { standalone?: boolean });
  const isIosStandalone =
    maybeStandaloneNavigator?.standalone === true;

  return isStandaloneDisplayMode || isIosStandalone;
}

function subscribeToStandaloneQuery(onStoreChange: () => void) {
  const mediaQueryList = getDisplayModeMediaQueryList();
  if (!mediaQueryList) return () => undefined;

  mediaQueryList.addEventListener('change', onStoreChange);
  return () => mediaQueryList.removeEventListener('change', onStoreChange);
}

export function useDisplayModeStandalone() {
  return React.useSyncExternalStore(
    subscribeToStandaloneQuery,
    getStandaloneSnapshot,
    () => false,
  );
}
