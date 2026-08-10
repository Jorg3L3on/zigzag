import { Ticket } from 'lucide-react';

import { ResourceRouteLoading } from '@/components/route-loading-skeletons';

export default function Loading() {
  return (
    <ResourceRouteLoading
      title="Tickets"
      description="Gestiona servicios, cobros y seguimiento."
      desktopDescription="Lista de todos los tickets registrados"
      icon={<Ticket className="size-5" aria-hidden />}
      label="Cargando tickets"
    />
  );
}
