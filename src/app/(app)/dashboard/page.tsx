import { Suspense } from 'react';
import nextDynamic from 'next/dynamic';
import { auth } from '@/lib/auth';
import { getExpiredLoginPath } from '@/lib/login-redirect';
import { redirect } from 'next/navigation';
import {
  TripledDashboardShell,
  TripledPageHeader,
} from '@/components/tripled';
import { DashboardPageIntro } from '@/components/dashboard/dashboard-page-intro';
import { requirePagePermission } from '@/lib/page-authz';
import { loadDashboardMetricsForCompany } from '@/actions/dashboard';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const DashboardMetricsClient = nextDynamic(
  () => import('@/components/dashboard/dashboard-metrics-client'),
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
          <div className="min-h-[20rem]">
            <Suspense fallback={null}>
              <DashboardMetricsSection
                companyId={Number(session.user.company_id)}
                companyIsSystem={Boolean(session.user.company_is_system)}
                userName={session.user.name}
              />
            </Suspense>
          </div>
        </div>
      </TripledDashboardShell>
    </>
  );
}
