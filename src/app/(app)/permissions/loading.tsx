import { KeyRound } from 'lucide-react';

import { ResourceRouteLoading } from '@/components/route-loading-skeletons';

export default function Loading() {
  return (
    <ResourceRouteLoading
      title="Catálogo de permisos"
      description="Claves de permiso que revisa el código. Solo para operadores del sistema."
      icon={<KeyRound className="size-5" aria-hidden />}
      label="Cargando permisos"
    />
  );
}
