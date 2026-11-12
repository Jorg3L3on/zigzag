import { Users } from 'lucide-react';

import { ResourceRouteLoading } from '@/components/route-loading-skeletons';

export default function Loading() {
  return (
    <ResourceRouteLoading
      title="Clientes"
      description="Catálogo de clientes y datos de contacto"
      icon={<Users className="size-5" aria-hidden />}
      label="Cargando clientes"
    />
  );
}
