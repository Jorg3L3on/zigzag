import {
  TripledDashboardShell,
  TripledMobileAppBar,
  TripledPageHeader,
  TripledResourceCard,
} from '@/components/tripled';
import { ShieldAlert } from 'lucide-react';

export default function ForbiddenPage() {
  return (
    <>
      <TripledPageHeader
        items={[{ label: 'Acceso denegado' }]}
        className="hidden md:flex"
      />
      <TripledDashboardShell maxWidthClassName="max-w-2xl">
        <TripledMobileAppBar title="Acceso denegado" className="mb-3" />
        <TripledResourceCard
          title="No tienes acceso"
          description="Tu rol no tiene permiso para ver esta sección."
          icon={<ShieldAlert className="size-5" aria-hidden />}
        >
          <p className="text-sm text-muted-foreground">
            Tu rol no tiene permiso para ver esta sección.
          </p>
        </TripledResourceCard>
      </TripledDashboardShell>
    </>
  );
}
