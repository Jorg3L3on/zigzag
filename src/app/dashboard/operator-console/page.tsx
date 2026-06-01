import { Building2 } from 'lucide-react';
import { CompaniesList } from '@/components/companies/companies-list';
import { OperatorActivityPanel } from '@/components/operator-console/operator-activity-panel';
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
          description="Vista central para operar empresas del sistema."
          desktopDescription="Busca, filtra y selecciona contexto de empresa para operaciones cross-tenant."
          icon={<Building2 className="size-5" aria-hidden />}
        >
          <CompaniesList />
          <OperatorCompanyOverview />
          <OperatorActivityPanel />
        </TripledResourceCard>
      </TripledDashboardShell>
    </>
  );
}
