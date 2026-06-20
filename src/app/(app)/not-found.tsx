import { SearchX } from 'lucide-react';
import { TripledRouteState } from '@/components/tripled';

export default function DashboardNotFound() {
  return (
    <TripledRouteState
      title="No encontramos este recurso"
      description="Puede que el registro ya no exista, haya sido eliminado o no esté disponible para tu empresa."
      icon={<SearchX className="h-5 w-5" aria-hidden />}
    />
  );
}
