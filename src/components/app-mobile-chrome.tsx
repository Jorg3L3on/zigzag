'use client';

import type { ReactNode } from 'react';

import { MobileBottomTabBar } from '@/components/mobile-bottom-tab-bar';
import { MobileChromeProvider, useMobileChrome } from '@/contexts/mobile-chrome-context';
import { MOBILE_BOTTOM_TAB_BAR_HEIGHT_PX } from '@/lib/nav-items';

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

/**
 * Mobile chrome for authenticated shell: bottom tabs + spacer, with sticky-action
 * coexistence via MobileChromeProvider.
 */
export const AppMobileChrome = ({ children }: { children: ReactNode }) => {
  return (
    <MobileChromeProvider>
      {children}
      <MobileBottomTabSpacer />
      <MobileBottomTabBar />
    </MobileChromeProvider>
  );
};
