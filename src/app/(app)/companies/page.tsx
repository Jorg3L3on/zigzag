import { Button } from '@/components/ui/button';
import {
  TripledDashboardShell,
  TripledPageHeader,
  TripledResourceCard,
} from '@/components/tripled';
import { CompaniesList } from '@/components/companies/companies-list';
import { requirePagePermission } from '@/lib/page-authz';
import { getSessionPermissionMap } from '@/actions/authz';
import { canAccessPermission, PERMISSIONS } from '@/lib/permissions';
import { Building2, Plus } from 'lucide-react';
import Link from 'next/link';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function CompaniesPage() {
  await requirePagePermission('companies.read');
  const permissionMap = await getSessionPermissionMap();
  const canWriteCompanies =
    permissionMap.isSystem &&
    canAccessPermission(permissionMap, PERMISSIONS.companies.write);

  return (
    <>
      <TripledPageHeader items={[{ label: 'Empresas' }]} />

      <TripledDashboardShell>
        <TripledResourceCard
          title="Empresas"
          description="Contextos de trabajo del sistema."
          desktopDescription="Administra las empresas disponibles en el sistema"
          icon={<Building2 className="size-5" aria-hidden />}
          action={
            canWriteCompanies ? (
              <Button
                asChild
                className="min-h-11 w-full gap-1.5 rounded-xl bg-primary px-4 text-sm font-semibold shadow-sm hover:bg-primary/90 sm:w-auto sm:self-start"
              >
                <Link href="/companies/new">
                  <Plus
                    className="h-4 w-4 shrink-0"
                    aria-hidden
                    data-icon="inline-start"
                  />
                  Nueva empresa
                </Link>
              </Button>
            ) : null
          }
        >
          <CompaniesList />
        </TripledResourceCard>
      </TripledDashboardShell>
    </>
  );
}
