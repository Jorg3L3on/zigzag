import { Wrench } from 'lucide-react';

import { ResourceRouteLoading } from '@/components/route-loading-skeletons';

export default function Loading() {
  return (
    <ResourceRouteLoading
      title="Servicios"
      description="Administra el catálogo de servicios disponibles"
      icon={<Wrench className="size-5" aria-hidden />}
      label="Cargando servicios"
    />
  );
}
