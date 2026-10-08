import { Metadata } from 'next';
import { Shield } from 'lucide-react';
import { TripledResourceCard } from '@/components/tripled';
import { RolesWorkspace } from '@/components/companies/roles/roles-workspace';
import { requirePagePermission } from '@/lib/page-authz';

export const metadata: Metadata = {
  title: 'Roles · Mi empresa',
  description: 'Roles y permisos de la empresa',
};

export default async function CompanyRolesPage() {
  await requirePagePermission('roles.read');

  return (
    <TripledResourceCard
      title="Roles"
      description="Qué puede ver y hacer cada persona del equipo."
      icon={<Shield className="size-5" aria-hidden />}
    >
      <RolesWorkspace />
    </TripledResourceCard>
  );
}
