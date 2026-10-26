'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import {
  COMPANY_HUB_TABS,
  getActiveCompanyHubTab,
  getCompanyHubSubpage,
  type CompanyHubTabKey,
} from '@/lib/company-hub';
import { cn } from '@/lib/utils';

type CompanyHubTabsProps = {
  /** Tabs the caller may open (server-checked); others are hidden. */
  visibleTabs: CompanyHubTabKey[];
  className?: string;
};

/**
 * Mi empresa hub navigation below lg (phones and tablets): a segmented pill.
 * From lg, `CompanyHubSideNav` (ZIG-I32-1). Route tabs are plain links with
 * `aria-current` (each tab is its own page).
 */
export const CompanyHubTabs = ({
  visibleTabs,
  className,
}: CompanyHubTabsProps) => {
  const pathname = usePathname();
  const activeKey = getActiveCompanyHubTab(pathname ?? '');
  // Full-screen editors replace the segmented control on mobile.
  const isSubpage = getCompanyHubSubpage(pathname ?? '') !== null;
  const tabs = COMPANY_HUB_TABS.filter((tab) => visibleTabs.includes(tab.key));

  if (tabs.length === 0) {
    return null;
  }

  return (
    <nav
      aria-label="Secciones de Mi empresa"
      className={cn('lg:hidden', className)}
      data-testid="company-hub-tabs"
    >
      <ul
        className={cn(
          'grid gap-0 rounded-full bg-muted p-1 lg:hidden',
          isSubpage && 'hidden',
        )}
        style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}
      >
        {tabs.map((tab) => {
          const isActive = tab.key === activeKey;
          return (
            <li key={tab.key} className="min-w-0">
              <Link
                href={tab.href}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'flex min-h-10 items-center justify-center truncate rounded-full px-2 text-sm font-semibold transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  isActive
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
};
