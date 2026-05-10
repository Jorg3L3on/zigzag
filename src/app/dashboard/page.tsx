import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { TripledPageHeader } from '@/components/tripled';
import { DashboardMetricsClient } from '@/components/dashboard/dashboard-metrics-client';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function DashboardPage() {
  const session = await auth();

  if (!session?.user?.company_id) {
    redirect('/login');
  }

  return (
    <>
      <TripledPageHeader items={[{ label: 'Dashboard' }]} />
      <div className="flex flex-1 flex-col gap-6 p-6">
        <DashboardMetricsClient />
      </div>
    </>
  );
}
