import { Metadata } from 'next';
import { Users } from 'lucide-react';
import { TripledResourceCard } from '@/components/tripled';
import { TeamList } from '@/components/companies/team/team-list';
import { COMPANY_HUB_CARD_DESKTOP_RESET } from '@/lib/company-hub';
import { requirePagePermission } from '@/lib/page-authz';

export const metadata: Metadata = {
  title: 'Equipo · Mi empresa',
  description: 'Usuarios de la empresa',
};

export default async function CompanyTeamPage() {
  await requirePagePermission('users.read');

  // Phones keep the card; lg+ shows TeamDesktop's own header (ZIG-I32-2, ZIG-I33-6).
  return (
    <TripledResourceCard
      title="Equipo"
      description="Personas con acceso a tu empresa y su rol."
      icon={<Users className="size-5" aria-hidden />}
      {...COMPANY_HUB_CARD_DESKTOP_RESET}
    >
      <TeamList />
    </TripledResourceCard>
  );
}
