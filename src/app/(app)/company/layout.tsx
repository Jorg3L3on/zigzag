import type { ReactNode } from 'react';
import { notFound, redirect } from 'next/navigation';

import {
  CompanyHubDesktopHeader,
  CompanyHubMobileAppBar,
  CompanyHubPageHeader,
} from '@/components/companies/company-hub-header';
import { CompanyHubSideNav } from '@/components/companies/company-hub-side-nav';
import { CompanyHubTabs } from '@/components/companies/company-hub-tabs';
import { TripledDashboardShell } from '@/components/tripled';
import { getCompanyHubSummary } from '@/lib/company-hub-summary';
import { getExpiredLoginPath } from '@/lib/login-redirect';
import { requireActionAuth } from '@/lib/security';

export const dynamic = 'force-dynamic';

/**
 * Mi empresa hub (ZIG-I3): Datos · Equipo · Roles. The layout only decides
 * which tabs to show; each page enforces its own permission. On md+ one
 * header and a side nav replace the tabs (ZIG-I32-1); phones keep the app
 * bar and the segmented tabs.
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

  return (
    <>
      <CompanyHubPageHeader />
      <TripledDashboardShell>
        <CompanyHubMobileAppBar companyName={summary.companyName} />
        <div className="flex flex-col gap-4 sm:gap-6">
          <CompanyHubDesktopHeader
            companyName={summary.companyName}
            logo={summary.logo}
            contact={summary.contact}
            productionReady={summary.productionReady}
          />
          <CompanyHubTabs visibleTabs={summary.tabs} />
          <div className="md:grid md:grid-cols-[11rem_minmax(0,1fr)] md:items-start md:gap-6 lg:grid-cols-[12.5rem_minmax(0,1fr)]">
            <CompanyHubSideNav
              visibleTabs={summary.tabs}
              counts={summary.counts}
              className="hidden md:block"
            />
            <div className="min-w-0">{children}</div>
          </div>
        </div>
      </TripledDashboardShell>
    </>
  );
}
