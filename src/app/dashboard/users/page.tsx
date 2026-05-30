import {
  TripledDashboardShell,
  TripledPageHeader,
  TripledResourceCard,
} from '@/components/tripled';
import { UsersList } from '@/components/users/users-list';
import { requirePagePermission } from '@/lib/page-authz';
import { Users } from 'lucide-react';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function UsersPage() {
  await requirePagePermission('users.read');

  return (
    <>
      <TripledPageHeader items={[{ label: 'Usuarios' }]} />

      <TripledDashboardShell>
        <TripledResourceCard
          title="Usuarios"
          description="Cuentas, roles y empresas asignadas."
          desktopDescription="Lista de todos los usuarios registrados en el sistema."
          icon={<Users className="size-5" aria-hidden />}
        >
          <UsersList />
        </TripledResourceCard>
      </TripledDashboardShell>
    </>
  );
}
