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
import { loadExperienceModeForCompany } from '@/actions/experience-mode';
import type { ExperienceMode } from '@/lib/experience-mode';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const DashboardMetricsClient = nextDynamic(
  () => import('@/components/dashboard/dashboard-metrics-client'),
);

const DashboardMetricsSection = async ({
  companyId,
  companyIsSystem,
  userName,
  initialExperienceMode,
}: {
  companyId: number;
  companyIsSystem: boolean;
  userName?: string | null;
  initialExperienceMode: ExperienceMode;
}) => {
  const initialMetrics = companyIsSystem
    ? null
    : (await loadDashboardMetricsForCompany(companyId, 1)).data ?? null;

  return (
    <DashboardMetricsClient
      initialMetrics={initialMetrics}
      userName={userName}
      initialExperienceMode={initialExperienceMode}
    />
  );
};

export default async function DashboardPage() {
  const session = await auth();

  if (!session?.user?.company_id) {
    redirect(getExpiredLoginPath());
  }
  await requirePagePermission('tickets.read');

  const companyId = Number(session.user.company_id);
  const companyIsSystem = Boolean(session.user.company_is_system);
  const experienceMode = companyIsSystem
    ? 'office'
    : await loadExperienceModeForCompany(companyId);
  const isCampo = experienceMode === 'campo';

  return (
    <>
      <TripledPageHeader
        items={[{ label: isCampo ? 'Hoy' : 'Dashboard' }]}
      />
      <TripledDashboardShell>
        <div className="flex flex-col gap-6 md:gap-8">
          <DashboardPageIntro
            userName={session.user.name}
            subtitle={
              isCampo ? 'Tu día en el campo' : 'Resumen de tu operación'
            }
          />
          <div className="min-h-[28rem]">
            <Suspense fallback={null}>
              <DashboardMetricsSection
                companyId={companyId}
                companyIsSystem={companyIsSystem}
                userName={session.user.name}
                initialExperienceMode={experienceMode}
              />
            </Suspense>
          </div>
        </div>
      </TripledDashboardShell>
    </>
  );
}
