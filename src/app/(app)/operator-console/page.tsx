import { Suspense } from 'react';
import { Building2 } from 'lucide-react';
import { OperatorCompanyFleet } from '@/components/operator-console/operator-company-fleet';
import { OperatorConsoleDetail } from '@/components/operator-console/operator-console-detail';
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
          description="Selecciona una empresa para ver su salud operativa y operarla."
          desktopDescription="Flota de tenants, métricas, actividad, acceso y ciclo de vida en un solo lugar."
          icon={<Building2 className="size-5" aria-hidden />}
        >
          <Suspense fallback={null}>
            <OperatorCompanyFleet />
          </Suspense>
          <OperatorConsoleDetail />
        </TripledResourceCard>
      </TripledDashboardShell>
    </>
  );
}
