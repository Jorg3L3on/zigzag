import { Metadata } from 'next';
import { Users } from 'lucide-react';
import { TripledResourceCard } from '@/components/tripled';
import { UsersList } from '@/components/users/users-list';
import { requirePagePermission } from '@/lib/page-authz';

export const metadata: Metadata = {
  title: 'Equipo · Mi empresa',
  description: 'Usuarios de la empresa',
};

export default async function CompanyTeamPage() {
  await requirePagePermission('users.read');

  return (
    <TripledResourceCard
      title="Equipo"
      description="Personas con acceso a tu empresa y su rol."
      icon={<Users className="size-5" aria-hidden />}
    >
      <UsersList />
    </TripledResourceCard>
  );
}
