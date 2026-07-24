import Link from 'next/link';
import { ArrowLeft, SearchX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TripledRouteState } from '@/components/tripled';

export default function DashboardNotFound() {
  return (
    <TripledRouteState
      title="No encontramos este recurso"
      description="Puede que el registro ya no exista, haya sido eliminado o no esté disponible para tu empresa."
      icon={<SearchX className="h-5 w-5" aria-hidden />}
      showBackLink={false}
    >
      <p className="text-sm text-muted-foreground">
        Puede que el registro ya no exista, haya sido eliminado o no esté
        disponible para tu empresa.
      </p>
      <Button variant="outline" asChild>
        <Link href="/dashboard">
          <ArrowLeft
            className="mr-2 h-4 w-4"
            aria-hidden
            data-icon="inline-start"
          />
          Volver al dashboard
        </Link>
      </Button>
    </TripledRouteState>
  );
}
