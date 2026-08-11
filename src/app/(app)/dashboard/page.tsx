import { auth } from '@/lib/auth';
import { getExpiredLoginPath } from '@/lib/login-redirect';
import { redirect } from 'next/navigation';
import {
  TripledDashboardShell,
  TripledPageHeader,
} from '@/components/tripled';
import { DashboardMetricsClient } from '@/components/dashboard/dashboard-metrics-client';
import { requirePagePermission } from '@/lib/page-authz';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

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
        <DashboardMetricsClient />
      </TripledDashboardShell>
    </>
  );
}
