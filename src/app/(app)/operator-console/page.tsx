import { Building2 } from 'lucide-react';
import { CompaniesList } from '@/components/companies/companies-list';
import { OperatorLifecyclePanel } from '@/components/operator-console/operator-lifecycle-panel';
import { OperatorAccessPanel } from '@/components/operator-console/operator-access-panel';
import { OperatorActivityPanel } from '@/components/operator-console/operator-activity-panel';
import { OperatorCompanyMetrics } from '@/components/operator-console/operator-company-metrics';
import { OperatorCompanyOverview } from '@/components/operator-console/operator-company-overview';
import {
  TripledDashboardShell,
  TripledPageHeader,
  TripledResourceCard,
} from '@/components/tripled';
import { requirePagePermission, requireSystemPage } from '@/lib/page-authz';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function OperatorConsolePage() {
  await requireSystemPage();
  await requirePagePermission('companies.read');

  return (
    <>
      <TripledPageHeader items={[{ label: 'Consola operadora' }]} />
      <TripledDashboardShell>
        <TripledResourceCard
          title="Consola operadora"
          description="Selecciona una empresa para ver su pulso de negocio y operarla."
          desktopDescription="Busca y selecciona una empresa para ver métricas, actividad, acceso y ciclo de vida."
          icon={<Building2 className="size-5" aria-hidden />}
        >
          <CompaniesList />
          <OperatorCompanyOverview />
          <OperatorCompanyMetrics />
          <OperatorActivityPanel />
          <OperatorAccessPanel />
          <OperatorLifecyclePanel />
        </TripledResourceCard>
      </TripledDashboardShell>
    </>
  );
}
