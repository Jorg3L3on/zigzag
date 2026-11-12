import { Building2 } from 'lucide-react';

import { ResourceRouteLoading } from '@/components/route-loading-skeletons';

export default function Loading() {
  return (
    <ResourceRouteLoading
      title="Empresas"
      description="Administra las empresas disponibles en el sistema"
      icon={<Building2 className="size-5" aria-hidden />}
      label="Cargando empresas"
    />
  );
}
