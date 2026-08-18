import { auth } from '@/lib/auth';
import { getExpiredLoginPath } from '@/lib/login-redirect';
import { redirect } from 'next/navigation';
import {
  TripledDashboardShell,
  TripledPageHeader,
} from '@/components/tripled';
import { DashboardMetricsClient } from '@/components/dashboard/dashboard-metrics-client';
import { requirePagePermission } from '@/lib/page-authz';
import { loadDashboardMetricsForCompany } from '@/actions/dashboard';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function DashboardPage() {
  const session = await auth();

  if (!session?.user?.company_id) {
    redirect(getExpiredLoginPath());
  }
  await requirePagePermission('tickets.read');

  const initialMetrics = session.user.company_is_system
    ? null
    : (await loadDashboardMetricsForCompany(
        Number(session.user.company_id),
        1,
      )).data ?? null;

  return (
    <>
      <TripledPageHeader items={[{ label: 'Dashboard' }]} />
      <TripledDashboardShell>
        <DashboardMetricsClient
          initialMetrics={initialMetrics}
          userName={session.user.name}
        />
      </TripledDashboardShell>
    </>
  );
}
