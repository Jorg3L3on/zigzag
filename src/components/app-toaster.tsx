'use client';

import { Toaster } from 'sonner';
import { useIsMobile } from '@/hooks/use-mobile';

/**
 * Toast placement:
 * - Mobile (< md): top-center, offset below safe-area and offline banner (--network-status-banner-offset).
 * - Desktop (≥ md): bottom-center with safe-area bottom inset on narrow viewports (Sonner mobileOffset).
 */
export const AppToaster = () => {
  const isMobile = useIsMobile();

  return (
    <Toaster
      position={isMobile ? 'top-center' : 'bottom-center'}
      offset={16}
      mobileOffset={
        isMobile
          ? {
              top: 'max(1rem, calc(env(safe-area-inset-top, 0px) + var(--network-status-banner-offset, 0px)))',
            }
          : {
              bottom: 'max(1rem, env(safe-area-inset-bottom, 0px))',
            }
      }
    />
  );
};
