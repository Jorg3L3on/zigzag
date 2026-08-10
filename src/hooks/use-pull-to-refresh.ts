import * as React from 'react';

import { useIsMobile } from '@/hooks/use-mobile';

const DEFAULT_PULL_THRESHOLD_PX = 72;
const MAX_PULL_DISTANCE_PX = 88;
const ACTIVE_SCROLL_TOP_TOLERANCE_PX = 2;

type PullToRefreshState = 'idle' | 'pulling' | 'ready' | 'refreshing';

type UsePullToRefreshOptions = {
  onRefresh: () => Promise<void> | void;
  disabled?: boolean;
  thresholdPx?: number;
};

const hasOpenOverlay = () =>
  typeof document !== 'undefined' &&
  document.querySelector('[role="dialog"]') !== null;

const shouldIgnoreTarget = (target: EventTarget | null) => {
  if (!(target instanceof Element)) return true;
  return Boolean(
    target.closest(
      [
        '[role="dialog"]',
        '[role="listbox"]',
        '[data-radix-popper-content-wrapper]',
        'button',
        'input',
        'select',
        'textarea',
        'a',
      ].join(','),
    ),
  );
};

const isPageScrolledToTop = () => {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return false;
  }

  return (
    window.scrollY <= ACTIVE_SCROLL_TOP_TOLERANCE_PX &&
    document.documentElement.scrollTop <= ACTIVE_SCROLL_TOP_TOLERANCE_PX &&
    document.body.scrollTop <= ACTIVE_SCROLL_TOP_TOLERANCE_PX
  );
};

export function usePullToRefresh({
  onRefresh,
  disabled = false,
  thresholdPx = DEFAULT_PULL_THRESHOLD_PX,
}: UsePullToRefreshOptions) {
  const isMobile = useIsMobile();
  const startYRef = React.useRef<number | null>(null);
  const [pullDistance, setPullDistance] = React.useState(0);
  const [state, setState] = React.useState<PullToRefreshState>('idle');

  const isRefreshing = state === 'refreshing';
  const isEnabled = isMobile && !disabled && !isRefreshing;

  const resetPull = React.useCallback(() => {
    startYRef.current = null;
    setPullDistance(0);
    setState('idle');
  }, []);

  const handleTouchStart = React.useCallback(
    (event: React.TouchEvent<HTMLElement>) => {
      if (
        !isEnabled ||
        hasOpenOverlay() ||
        shouldIgnoreTarget(event.target) ||
        !isPageScrolledToTop()
      ) {
        startYRef.current = null;
        return;
      }

      startYRef.current = event.touches[0]?.clientY ?? null;
    },
    [isEnabled],
  );

  const handleTouchMove = React.useCallback(
    (event: React.TouchEvent<HTMLElement>) => {
      if (startYRef.current === null || !isEnabled) return;

      const currentY = event.touches[0]?.clientY;
      if (currentY == null) return;

      const deltaY = currentY - startYRef.current;
      if (deltaY <= 0) {
        resetPull();
        return;
      }

      const nextDistance = Math.min(deltaY * 0.55, MAX_PULL_DISTANCE_PX);
      setPullDistance(nextDistance);
      setState(nextDistance >= thresholdPx ? 'ready' : 'pulling');
    },
    [isEnabled, resetPull, thresholdPx],
  );

  const handleTouchEnd = React.useCallback(() => {
    if (startYRef.current === null) return;

    const shouldRefresh = pullDistance >= thresholdPx && isEnabled;
    startYRef.current = null;

    if (!shouldRefresh) {
      resetPull();
      return;
    }

    setState('refreshing');
    setPullDistance(48);

    void Promise.resolve(onRefresh())
      .catch(() => undefined)
      .finally(() => {
        setPullDistance(0);
        setState('idle');
      });
  }, [isEnabled, onRefresh, pullDistance, resetPull, thresholdPx]);

  return {
    containerProps: {
      'data-ptr-state': state,
      onTouchStart: handleTouchStart,
      onTouchMove: handleTouchMove,
      onTouchEnd: handleTouchEnd,
      onTouchCancel: resetPull,
    },
    isRefreshing,
    pullDistance,
    state,
  };
}
