import type { ReactNode } from 'react';
import { notFound, redirect } from 'next/navigation';

import {
  CompanyHubMobileAppBar,
  CompanyHubPageHeader,
} from '@/components/companies/company-hub-header';
import { CompanyHubTabs } from '@/components/companies/company-hub-tabs';
import { TripledDashboardShell } from '@/components/tripled';
import { getCompanyHubSummary } from '@/lib/company-hub-summary';
import { getExpiredLoginPath } from '@/lib/login-redirect';
import { requireActionAuth } from '@/lib/security';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';

/**
 * Mi empresa hub (ZIG-I3): Datos · Equipo · Roles. The layout only decides
 * which tabs to show; each page enforces its own permission.
 */
export default async function CompanyHubLayout({
  children,
}: {
  children: ReactNode;
}) {
  let context;
  try {
    context = await requireActionAuth();
  } catch {
    redirect(getExpiredLoginPath());
  }

  const summary = await getCompanyHubSummary(context);
  if (!summary) {
    notFound();
  }
  if (summary.tabs.length === 0) {
    redirect('/forbidden');
  }

  const readinessLabel = summary.productionReady
    ? 'Lista para operar'
    : 'Configuración pendiente';

  return (
    <>
      <CompanyHubPageHeader />
      <TripledDashboardShell>
        <CompanyHubMobileAppBar companyName={summary.companyName} />
        <div className="flex flex-col gap-4 sm:gap-6">
          <div className="hidden flex-wrap items-end justify-between gap-4 md:flex">
            <div className="flex min-w-0 flex-col gap-1">
              <h1 className="truncate text-2xl font-bold tracking-tight">
                {summary.companyName}
              </h1>
              <p className="text-sm text-muted-foreground">
                Datos de la empresa, equipo y roles en un solo lugar.
              </p>
            </div>
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <span
                aria-hidden
                className={cn(
                  'size-2.5 rounded-full',
                  summary.productionReady ? 'bg-emerald-600' : 'bg-amber-500',
                )}
              />
              {readinessLabel}
            </p>
          </div>
          <CompanyHubTabs visibleTabs={summary.tabs} counts={summary.counts} />
          {children}
        </div>
      </TripledDashboardShell>
    </>
  );
}
