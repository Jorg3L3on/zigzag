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
  counts?: Partial<Record<CompanyHubTabKey, number>>;
  className?: string;
};

/**
 * Mi empresa hub navigation: underline tabs on md+, segmented pill below.
 * Route tabs are plain links with `aria-current` (each tab is its own page).
 */
export const CompanyHubTabs = ({
  visibleTabs,
  counts = {},
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
      className={className}
      data-testid="company-hub-tabs"
    >
      {/* Mobile: segmented control */}
      <ul
        className={cn(
          'grid gap-0 rounded-full bg-muted p-1 md:hidden',
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

      {/* Desktop: underline tabs with counts */}
      <ul className="hidden gap-1 border-b border-border md:flex">
        {tabs.map((tab) => {
          const isActive = tab.key === activeKey;
          const tabCount = counts[tab.key];
          return (
            <li key={tab.key}>
              <Link
                href={tab.href}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  '-mb-px inline-flex h-11 items-center gap-2 border-b-2 px-4 text-sm font-semibold transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  isActive
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground',
                )}
              >
                {tab.label}
                {typeof tabCount === 'number' ? (
                  <span
                    className={cn(
                      'rounded-full px-2 py-0.5 text-xs font-bold tabular-nums',
                      isActive
                        ? 'bg-primary/10 text-primary'
                        : 'bg-muted text-muted-foreground',
                    )}
                  >
                    {tabCount}
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
};
