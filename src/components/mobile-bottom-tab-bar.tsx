'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { KeyboardEvent } from 'react';
import { MoreHorizontal } from 'lucide-react';

import { useMobileChrome } from '@/contexts/mobile-chrome-context';
import { usePermissions } from '@/hooks/use-permissions';
import {
  getLongestMatchingHref,
  MOBILE_BOTTOM_TAB_BAR_HEIGHT_PX,
  MOBILE_TAB_ITEMS,
} from '@/lib/nav-items';
import { cn } from '@/lib/utils';
import { useSidebar } from '@/components/ui/sidebar';

export const MobileBottomTabBar = () => {
  const pathname = usePathname();
  const { can } = usePermissions();
  const { setOpenMobile } = useSidebar();
  const { hasStickyAction } = useMobileChrome();

  const visibleTabs = MOBILE_TAB_ITEMS.filter((item) =>
    can(item.requiredPermission),
  );

  const activeHref = getLongestMatchingHref(
    pathname,
    visibleTabs.map((item) => item.url),
  );

  if (hasStickyAction) {
    return null;
  }

  const handleOpenMore = () => {
    setOpenMobile(true);
  };

  const handleMoreKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleOpenMore();
    }
  };

  return (
    <nav
      aria-label="Navegación principal"
      data-testid="mobile-bottom-tab-bar"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-border/60 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 md:hidden"
      style={{
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      <ul
        className="mx-auto flex max-w-lg items-stretch justify-around"
        style={{ minHeight: MOBILE_BOTTOM_TAB_BAR_HEIGHT_PX }}
      >
        {visibleTabs.map((item) => {
          const isActive = activeHref === item.url;
          const Icon = item.icon;
          return (
            <li key={item.url} className="min-w-0 flex-1">
              <Link
                href={item.url}
                aria-current={isActive ? 'page' : undefined}
                aria-label={item.title}
                className={cn(
                  'flex h-14 min-h-11 flex-col items-center justify-center gap-0.5 px-1 text-[11px] font-medium transition-colors',
                  isActive
                    ? 'text-primary'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {Icon ? (
                  <Icon className="h-5 w-5 shrink-0" aria-hidden />
                ) : null}
                <span className="max-w-full truncate">{item.title}</span>
              </Link>
            </li>
          );
        })}
        <li className="min-w-0 flex-1">
          <button
            type="button"
            aria-label="Más — abrir menú de navegación"
            tabIndex={0}
            onClick={handleOpenMore}
            onKeyDown={handleMoreKeyDown}
            className={cn(
              'flex h-14 min-h-11 w-full flex-col items-center justify-center gap-0.5 px-1 text-[11px] font-medium transition-colors',
              activeHref === null
                ? 'text-primary'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <MoreHorizontal className="h-5 w-5 shrink-0" aria-hidden />
            <span>Más</span>
          </button>
        </li>
      </ul>
    </nav>
  );
};
