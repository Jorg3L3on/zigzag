'use client';

import * as React from 'react';

import { DesktopLayoutContext, useDesktopViewport } from '@/hooks/use-desktop';
import { cn } from '@/lib/utils';

type DesktopSwitchProps = {
  phone: React.ReactNode;
  desktop: React.ReactNode;
  /** Extra classes for the wrapper of each tree, e.g. to keep a flex or grid child. */
  phoneClassName?: string;
  desktopClassName?: string;
};

/**
 * The phone tree below lg, the desktop tree from lg, with no wrong first paint
 * (ZIG-28). The server does not know the width, so the first frame has both trees
 * and CSS shows the right one; once the width is known only that tree stays mounted
 * (no duplicate ids, controls or test ids). The pattern of CobranzaView (ZIG-I31).
 */
export const DesktopSwitch = ({
  phone,
  desktop,
  phoneClassName,
  desktopClassName,
}: DesktopSwitchProps) => {
  const isDesktop = useDesktopViewport();
  // Marks the frame with both trees, so e2e can wait for the page to settle.
  const pending = isDesktop === null ? '' : undefined;
  return (
    <>
      {isDesktop !== true ? (
        <DesktopLayoutContext.Provider value={false}>
          <div className={cn('lg:hidden', phoneClassName)} data-layout-pending={pending}>
            {phone}
          </div>
        </DesktopLayoutContext.Provider>
      ) : null}
      {isDesktop !== false ? (
        <DesktopLayoutContext.Provider value>
          <div className={cn('hidden lg:block', desktopClassName)} data-layout-pending={pending}>
            {desktop}
          </div>
        </DesktopLayoutContext.Provider>
      ) : null}
    </>
  );
};
