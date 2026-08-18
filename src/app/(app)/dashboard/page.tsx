import { Suspense } from 'react';
import { auth } from '@/lib/auth';
import { getExpiredLoginPath } from '@/lib/login-redirect';
import { redirect } from 'next/navigation';
import {
  TripledDashboardShell,
  TripledPageHeader,
} from '@/components/tripled';
import { DashboardMetricsClient } from '@/components/dashboard/dashboard-metrics-client';
import { DashboardPageIntro } from '@/components/dashboard/dashboard-page-intro';
import { Skeleton } from '@/components/ui/skeleton';
import { requirePagePermission } from '@/lib/page-authz';
import { loadDashboardMetricsForCompany } from '@/actions/dashboard';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const DashboardMetricsFallback = () => (
  <div className="grid grid-cols-2 gap-4 lg:grid-cols-4" aria-busy="true">
    {Array.from({ length: 4 }).map((_, index) => (
      <Skeleton key={index} className="h-40 rounded-xl" />
    ))}
  </div>
);

const DashboardMetricsSection = async ({
  companyId,
  companyIsSystem,
  userName,
}: {
  companyId: number;
  companyIsSystem: boolean;
  userName?: string | null;
}) => {
  const initialMetrics = companyIsSystem
    ? null
    : (await loadDashboardMetricsForCompany(companyId, 1)).data ?? null;

  return (
    <DashboardMetricsClient
      initialMetrics={initialMetrics}
      userName={userName}
      hideIntro
    />
  );
};

export default async function DashboardPage() {
  const session = await auth();

  if (!session?.user?.company_id) {
    redirect(getExpiredLoginPath());
  }
  await requirePagePermission('tickets.read');

  return (
    <>
      <TripledPageHeader items={[{ label: 'Dashboard' }]} />
      <TripledDashboardShell>
        <div className="flex flex-col gap-6 md:gap-8">
          <DashboardPageIntro
            userName={session.user.name}
            subtitle="Resumen de tu operación"
          />
          <Suspense fallback={<DashboardMetricsFallback />}>
            <DashboardMetricsSection
              companyId={Number(session.user.company_id)}
              companyIsSystem={Boolean(session.user.company_is_system)}
              userName={session.user.name}
            />
          </Suspense>
        </div>
      </TripledDashboardShell>
    </>
  );
}
