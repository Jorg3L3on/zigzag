import { CalendarClock } from 'lucide-react';

import { ResourceRouteLoading } from '@/components/route-loading-skeletons';

export default function Loading() {
  return (
    <ResourceRouteLoading
      title="Recordatorios de servicio"
      description="Gestiona recordatorios por cliente y servicio"
      icon={<CalendarClock className="size-5" aria-hidden />}
      label="Cargando recordatorios"
    />
  );
}
