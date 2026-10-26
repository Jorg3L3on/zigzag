'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import {
  COMPANY_HUB_PATH,
  COMPANY_HUB_TABS,
  getActiveCompanyHubTab,
  type CompanyHubTabKey,
} from '@/lib/company-hub';
import { COMPANY_DESKTOP_SECTIONS } from '@/lib/company-form-sections';
import { cn } from '@/lib/utils';

type CompanyHubSideNavProps = {
  /** Tabs the caller may open (server-checked); others are hidden. */
  visibleTabs: CompanyHubTabKey[];
  counts?: Partial<Record<CompanyHubTabKey, number>>;
  className?: string;
};

const itemClass = (active: boolean) =>
  cn(
    'flex min-h-9 items-center justify-between gap-2 rounded-lg px-2.5 text-sm transition-colors',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
    active
      ? 'bg-primary/10 font-medium text-primary'
      : 'text-foreground/80 hover:bg-muted hover:text-foreground',
  );

/**
 * Mi empresa navigation on md+ (ZIG-I32-1): Datos with its sections as
 * anchors, then Equipo · N and Roles · N. Phones keep `CompanyHubTabs`.
 */
export const CompanyHubSideNav = ({
  visibleTabs,
  counts = {},
  className,
}: CompanyHubSideNavProps) => {
  const pathname = usePathname();
  const activeKey = getActiveCompanyHubTab(pathname ?? '');
  const tabs = COMPANY_HUB_TABS.filter((tab) => visibleTabs.includes(tab.key));
  const onDatos = activeKey === 'datos';

  return (
    <nav
      aria-label="Secciones de Mi empresa"
      className={cn('md:sticky md:top-20', className)}
      data-testid="company-hub-side-nav"
    >
      <ul className="flex flex-col gap-0.5">
        {tabs.map((tab) => {
          const isActive = tab.key === activeKey;
          const tabCount = counts[tab.key];
          return (
            <li key={tab.key}>
              <Link
                href={tab.href}
                aria-current={isActive ? 'page' : undefined}
                className={itemClass(isActive)}
              >
                <span className="truncate">{tab.label}</span>
                {typeof tabCount === 'number' ? (
                  <span className="text-caption tabular-nums text-muted-foreground">
                    {tabCount}
                  </span>
                ) : null}
              </Link>
              {tab.key === 'datos' ? (
                <ul className="mt-0.5 flex flex-col gap-0.5 pb-1">
                  {COMPANY_DESKTOP_SECTIONS.map((section) => (
                    <li key={section.id}>
                      <Link
                        href={onDatos ? `#${section.id}` : `${COMPANY_HUB_PATH}#${section.id}`}
                        className="flex min-h-8 items-center rounded-lg pl-5 pr-2.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {section.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          );
        })}
      </ul>
    </nav>
  );
};
