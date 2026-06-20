import {
  TripledDashboardShell,
  TripledPageHeader,
  TripledResourceCard,
} from '@/components/tripled';
import { RolesList } from '@/components/roles/roles-list';
import { requirePagePermission } from '@/lib/page-authz';
import { Shield } from 'lucide-react';

export default async function RolesPage() {
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
