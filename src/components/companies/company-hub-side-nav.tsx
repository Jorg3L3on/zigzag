'use client';

import * as React from 'react';
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
      ? 'bg-primary/10 font-medium text-blue-700 dark:text-blue-300'
      : 'text-foreground/80 hover:bg-muted hover:text-foreground',
  );

// Selected = primary tint with blue-700 text: primary (#2563eb) on the tint is
// 4.48:1, under AA (ZIG-I32 review).
const groupLabelClass =
  'px-2.5 pb-1.5 text-caption font-semibold uppercase tracking-wider text-muted-foreground';

/**
 * The Datos section in view, for the side nav highlight: the last section
 * whose top has passed the upper third of the viewport (first one at the top).
 */
const useSectionInView = (enabled: boolean): string => {
  const [active, setActive] = React.useState<string>(COMPANY_DESKTOP_SECTIONS[0].id);

  React.useEffect(() => {
    if (!enabled) {
      return;
    }
    const update = () => {
      const line = window.innerHeight / 3;
      let current: string = COMPANY_DESKTOP_SECTIONS[0].id;
      for (const section of COMPANY_DESKTOP_SECTIONS) {
        const element = document.getElementById(section.id);
        if (element && element.getBoundingClientRect().top <= line) {
          current = section.id;
        }
      }
      setActive(current);
    };
    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('hashchange', update);
    return () => {
      window.removeEventListener('scroll', update);
      window.removeEventListener('hashchange', update);
    };
  }, [enabled]);

  return active;
};

/**
 * Mi empresa navigation from lg (ZIG-I32-1, canvas EmpDatos): a "Datos" group
 * with its sections as anchors (the one in view highlighted), then "Hub" with
 * Equipo · N and Roles · N. Below lg, `CompanyHubTabs`.
 */
export const CompanyHubSideNav = ({
  visibleTabs,
  counts = {},
  className,
}: CompanyHubSideNavProps) => {
  const pathname = usePathname();
  const activeKey = getActiveCompanyHubTab(pathname ?? '');
  const onDatos = activeKey === 'datos';
  const sectionInView = useSectionInView(onDatos);
  const showDatos = visibleTabs.includes('datos');
  const hubTabs = COMPANY_HUB_TABS.filter(
    (tab) => tab.key !== 'datos' && visibleTabs.includes(tab.key),
  );

  return (
    <nav
      aria-label="Secciones de Mi empresa"
      className={cn('flex flex-col gap-4 lg:sticky lg:top-20', className)}
      data-testid="company-hub-side-nav"
    >
      {showDatos ? (
        <div>
          <p className={groupLabelClass}>Datos</p>
          <ul className="flex flex-col gap-0.5">
            {COMPANY_DESKTOP_SECTIONS.map((section, index) => {
              const isActive = onDatos && section.id === sectionInView;
              return (
                <li key={section.id}>
                  <Link
                    href={onDatos ? `#${section.id}` : `${COMPANY_HUB_PATH}#${section.id}`}
                    aria-current={isActive ? 'location' : undefined}
                    className={cn(itemClass(isActive), index > 0 && 'pl-5')}
                  >
                    {section.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
      {hubTabs.length > 0 ? (
        <div>
          <p className={groupLabelClass}>Hub</p>
          <ul className="flex flex-col gap-0.5">
            {hubTabs.map((tab) => {
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
                      <span
                        className={cn(
                          'text-caption tabular-nums',
                          isActive ? 'text-current' : 'text-muted-foreground',
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
        </div>
      ) : null}
    </nav>
  );
};
