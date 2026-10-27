import { Shield } from 'lucide-react';

import { ResourceRouteLoading } from '@/components/route-loading-skeletons';

export default function Loading() {
  return (
    <ResourceRouteLoading
      title="Roles (todas las empresas)"
      description="Roles de todas las empresas y roles compartidos. Cada empresa edita los suyos en Mi empresa › Roles."
      icon={<Shield className="size-5" aria-hidden />}
      label="Cargando roles"
    />
  );
}
