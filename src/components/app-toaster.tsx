'use client';

import { Toaster } from 'sonner';
import { useTheme } from 'next-themes';
import { useIsMobile } from '@/hooks/use-mobile';

/**
 * Toast placement:
 * - Mobile (< md): top-center, offset below safe-area and offline banner (--network-status-banner-offset).
 * - Desktop (≥ md): bottom-center with safe-area bottom inset on narrow viewports (Sonner mobileOffset).
 */
export const AppToaster = () => {
  const isMobile = useIsMobile();
  const { resolvedTheme } = useTheme();

  return (
    <Toaster
      // Radix modals (sheets, dialogs) make the rest of the page inert, and the
      // toaster inherits that: without this a Deshacer inside an open sheet
      // cannot be tapped (ZIG-I13-2).
      style={{ pointerEvents: 'auto' }}
      theme={resolvedTheme === 'dark' ? 'dark' : 'light'}
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
