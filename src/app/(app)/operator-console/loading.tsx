import { Building2 } from 'lucide-react';

import { ResourceRouteLoading } from '@/components/route-loading-skeletons';

export default function Loading() {
  return (
    <ResourceRouteLoading
      title="Consola operadora"
      description="Todas las empresas de ZigZag y en qué estado está cada una"
      icon={<Building2 className="size-5" aria-hidden />}
      label="Cargando consola operadora"
    />
  );
}
