import { Users } from 'lucide-react';

import { ResourceRouteLoading } from '@/components/route-loading-skeletons';

export default function Loading() {
  return (
    <ResourceRouteLoading
      title="Usuarios (todas las empresas)"
      description="Usuarios de todas las empresas. Cada empresa gestiona su equipo en Mi empresa › Equipo."
      icon={<Users className="size-5" aria-hidden />}
      label="Cargando usuarios"
    />
  );
}
