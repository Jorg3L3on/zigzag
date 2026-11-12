import {
  TripledDashboardShell,
  TripledPageHeader,
  TripledResourceCard,
} from '@/components/tripled';
import { UsersList } from '@/components/users/users-list';
import { COMPANY_HUB_TEAM_PATH } from '@/lib/company-hub';
import {
  redirectTenantToCompanyHub,
  requirePagePermission,
  requireSystemPage,
} from '@/lib/page-authz';
import { Users } from 'lucide-react';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function UsersPage() {
  await redirectTenantToCompanyHub(COMPANY_HUB_TEAM_PATH);
  // System operators only (ZIG-I3-6); tenants use the Mi empresa hub.
  await requireSystemPage();
  await requirePagePermission('users.read');

  return (
    <>
      <TripledPageHeader items={[{ label: 'Usuarios (todas las empresas)' }]} />

      <TripledDashboardShell>
        {/* From lg the list draws its own title with the count, without the card (ZIG-I33). */}
        <TripledResourceCard
          desktop="title"
          headerClassName="lg:hidden"
          title="Usuarios (todas las empresas)"
          description="Usuarios de todas las empresas. Cada empresa gestiona su equipo en Mi empresa › Equipo."
          icon={<Users className="size-5" aria-hidden />}
        >
          <UsersList />
        </TripledResourceCard>
      </TripledDashboardShell>
    </>
  );
}
