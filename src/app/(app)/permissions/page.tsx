import {
  TripledDashboardShell,
  TripledPageHeader,
  TripledResourceCard,
} from '@/components/tripled';
import { PermissionsList } from '@/components/permissions/permissions-list';
import { requirePagePermission } from '@/lib/page-authz';
import { KeyRound } from 'lucide-react';

export default async function PermissionsPage() {
  await requirePagePermission('permissions.read');

  return (
    <>
      <TripledPageHeader items={[{ label: 'Permisos' }]} />

      <TripledDashboardShell>
        <TripledResourceCard
          title="Permisos"
          description="Capacidades del sistema y alcance por empresa."
          desktopDescription="Lista de todos los permisos registrados."
          icon={<KeyRound className="size-5" aria-hidden />}
        >
          <PermissionsList />
        </TripledResourceCard>
      </TripledDashboardShell>
    </>
  );
}
