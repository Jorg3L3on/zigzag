import {
  TripledDashboardShell,
  TripledPageHeader,
  TripledResourceCard,
} from '@/components/tripled';
import { PermissionsList } from '@/components/permissions/permissions-list';
import { COMPANY_HUB_ROLES_PATH } from '@/lib/company-hub';
import {
  redirectTenantToCompanyHub,
  requirePagePermission,
  requireSystemPage,
} from '@/lib/page-authz';
import { KeyRound } from 'lucide-react';

export default async function PermissionsPage() {
  await redirectTenantToCompanyHub(COMPANY_HUB_ROLES_PATH);
  // System operators only (ZIG-I3-6); tenants use the Mi empresa hub.
  await requireSystemPage();
  await requirePagePermission('permissions.read');

  return (
    <>
      <TripledPageHeader items={[{ label: 'Catálogo de permisos' }]} />

      <TripledDashboardShell>
        <TripledResourceCard
          title="Catálogo de permisos"
          description="Capacidades del sistema y alcance por empresa."
          desktopDescription="Claves de permiso que revisa el código. Solo para operadores del sistema."
          icon={<KeyRound className="size-5" aria-hidden />}
        >
          <PermissionsList />
        </TripledResourceCard>
      </TripledDashboardShell>
    </>
  );
}
