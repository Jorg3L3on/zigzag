import { Metadata } from 'next';
import { Shield } from 'lucide-react';
import { TripledResourceCard } from '@/components/tripled';
import { RolesWorkspace } from '@/components/companies/roles/roles-workspace';
import { COMPANY_HUB_CARD_DESKTOP_RESET } from '@/lib/company-hub';
import { requirePagePermission } from '@/lib/page-authz';

export const metadata: Metadata = {
  title: 'Roles · Mi empresa',
  description: 'Roles y permisos de la empresa',
};

export default async function CompanyRolesPage() {
  await requirePagePermission('roles.read');

  // Phones keep the card; md+ shows the workspace's own header (ZIG-I32-3).
  return (
    <TripledResourceCard
      title="Roles"
      description="Qué puede ver y hacer cada persona del equipo."
      icon={<Shield className="size-5" aria-hidden />}
      {...COMPANY_HUB_CARD_DESKTOP_RESET}
    >
      <RolesWorkspace />
    </TripledResourceCard>
  );
}
