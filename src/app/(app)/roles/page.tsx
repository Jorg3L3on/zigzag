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
  requireSystemPage,
} from '@/lib/page-authz';
import { Shield } from 'lucide-react';

export default async function RolesPage() {
  await redirectTenantToCompanyHub(COMPANY_HUB_ROLES_PATH);
  // System operators only (ZIG-I3-6); tenants use the Mi empresa hub.
  await requireSystemPage();
  await requirePagePermission('roles.read');

  return (
    <>
      <TripledPageHeader items={[{ label: 'Roles (todas las empresas)' }]} />

      <TripledDashboardShell>
        <TripledResourceCard
          title="Roles (todas las empresas)"
          description="Perfiles de acceso y permisos asignados."
          desktopDescription="Roles de todas las empresas y roles compartidos. Cada empresa edita los suyos en Mi empresa › Roles."
          icon={<Shield className="size-5" aria-hidden />}
        >
          <RolesList />
        </TripledResourceCard>
      </TripledDashboardShell>
    </>
  );
}
