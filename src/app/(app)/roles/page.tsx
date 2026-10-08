import {
  TripledDashboardShell,
  TripledPageHeader,
  TripledResourceCard,
} from '@/components/tripled';
import { RolesList } from '@/components/roles/roles-list';
import { COMPANY_HUB_ROLES_PATH } from '@/lib/company-hub';
import {
  redirectTenantToCompanyHub,
  requirePagePermission,
} from '@/lib/page-authz';
import { Shield } from 'lucide-react';

export default async function RolesPage() {
  await redirectTenantToCompanyHub(COMPANY_HUB_ROLES_PATH);
  await requirePagePermission('roles.read');

  return (
    <>
      <TripledPageHeader items={[{ label: 'Roles' }]} />

      <TripledDashboardShell>
        <TripledResourceCard
          title="Roles"
          description="Perfiles de acceso y permisos asignados."
          desktopDescription="Lista de todos los roles registrados."
          icon={<Shield className="size-5" aria-hidden />}
        >
          <RolesList />
        </TripledResourceCard>
      </TripledDashboardShell>
    </>
  );
}
