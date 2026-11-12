import { redirect } from 'next/navigation';
import { Building2 } from 'lucide-react';
import { OperatorCompanyFleet } from '@/components/operator-console/operator-company-fleet';
import {
  TripledDashboardShell,
  TripledPageHeader,
  TripledResourceCard,
} from '@/components/tripled';
import { requirePagePermission, requireSystemPage } from '@/lib/page-authz';
import {
  OPERATOR_CONSOLE_COMPANY_QUERY_PARAM,
  operatorConsoleCompanyHref,
} from '@/lib/operator-tenant-scope';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/** The fleet (ZIG-I38): one page; each company has its own at /operator-console/[id]. */
export default async function OperatorConsolePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireSystemPage();
  await requirePagePermission('companies.read');

  // Old links (`?company=N`) open the company page instead (ZIG-I38-2).
  const params = await searchParams;
  const raw = params[OPERATOR_CONSOLE_COMPANY_QUERY_PARAM];
  const legacy = Number.parseInt(Array.isArray(raw) ? raw[0] ?? '' : raw ?? '', 10);
  if (Number.isInteger(legacy) && legacy > 0) {
    redirect(operatorConsoleCompanyHref(legacy));
  }

  return (
    <>
      <TripledPageHeader items={[{ label: 'Consola operadora' }]} />
      <TripledDashboardShell>
        {/* From lg no card: the fleet draws its own title row with the count (ZIG-I33 §1). */}
        <TripledResourceCard
          desktop="title"
          headerClassName="lg:hidden"
          title="Consola operadora"
          description="Todas las empresas de ZigZag y en qué estado está cada una."
          icon={<Building2 className="size-5" aria-hidden />}
        >
          <OperatorCompanyFleet />
        </TripledResourceCard>
      </TripledDashboardShell>
    </>
  );
}
