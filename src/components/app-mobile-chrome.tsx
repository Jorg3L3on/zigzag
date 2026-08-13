'use client';

import type { ReactNode } from 'react';
import * as React from 'react';
import { usePathname, useRouter } from 'next/navigation';

import { MobileBottomTabBar } from '@/components/mobile-bottom-tab-bar';
import { OperatorTenantCompanySync } from '@/components/operator-tenant-company-sync';
import { MobileChromeProvider, useMobileChrome } from '@/contexts/mobile-chrome-context';
import { useDisplayModeStandalone } from '@/hooks/use-display-mode-standalone';
import { useIsMobile } from '@/hooks/use-mobile';
import { MOBILE_BOTTOM_TAB_BAR_HEIGHT_PX } from '@/lib/nav-items';

const IDLE_PREFETCH_SESSION_KEY = 'zigzag:mobile-shell-prefetched';
const IDLE_PREFETCH_ROUTES = ['/dashboard', '/tickets', '/clients'] as const;

const IdlePrefetch = () => {
  const router = useRouter();
  const isMobile = useIsMobile();

  React.useEffect(() => {
    if (!isMobile) {
      return;
    }

    try {
      if (window.sessionStorage.getItem(IDLE_PREFETCH_SESSION_KEY) === '1') {
        return;
      }
    } catch {
      // Storage can be unavailable in restrictive browser modes; prefetch is best effort.
    }

    const prefetchRoutes = () => {
      try {
        window.sessionStorage.setItem(IDLE_PREFETCH_SESSION_KEY, '1');
      } catch {
        // Ignore unavailable sessionStorage; the route prefetches are still safe.
      }
      IDLE_PREFETCH_ROUTES.forEach((href) => router.prefetch(href));
    };

    const idleWindow = window as Window & {
      requestIdleCallback?: (
        callback: () => void,
        options?: { timeout?: number },
      ) => number;
      cancelIdleCallback?: (handle: number) => void;
    };

    if (idleWindow.requestIdleCallback) {
      const handle = idleWindow.requestIdleCallback(prefetchRoutes, {
        timeout: 3000,
      });
      return () => idleWindow.cancelIdleCallback?.(handle);
    }

    const timeoutId = window.setTimeout(prefetchRoutes, 1200);
    return () => window.clearTimeout(timeoutId);
  }, [isMobile, router]);

  return null;
};

const MobileBottomTabSpacer = () => {
  const { hasStickyAction } = useMobileChrome();
  if (hasStickyAction) {
    return null;
  }

  return (
    <div
      aria-hidden
      data-testid="mobile-bottom-tab-spacer"
      className="shrink-0 md:hidden"
      style={{
        height: `calc(${MOBILE_BOTTOM_TAB_BAR_HEIGHT_PX}px + env(safe-area-inset-bottom, 0px))`,
      }}
    />
  );
};

const AppContentTransition = ({ children }: { children: ReactNode }) => {
  const pathname = usePathname();

  return (
    <div
      key={pathname}
      className="app-content-transition flex min-w-0 flex-1 flex-col"
    >
      {children}
    </div>
  );
};

const DisplayModeStandaloneMarker = () => {
  const isStandalone = useDisplayModeStandalone();

  React.useEffect(() => {
    const root = document.documentElement;
    root.dataset.displayMode = isStandalone ? 'standalone' : 'browser';

    return () => {
      delete root.dataset.displayMode;
    };
  }, [isStandalone]);

  return null;
};

/**
 * Mobile chrome for authenticated shell: bottom tabs + spacer, with sticky-action
 * coexistence via MobileChromeProvider.
 */
export const AppMobileChrome = ({ children }: { children: ReactNode }) => {
  return (
    <MobileChromeProvider>
      <DisplayModeStandaloneMarker />
      <OperatorTenantCompanySync />
      <IdlePrefetch />
      <AppContentTransition>{children}</AppContentTransition>
      <MobileBottomTabSpacer />
      <MobileBottomTabBar />
    </MobileChromeProvider>
  );
};
