import {
  TripledDashboardShell,
  TripledMobileAppBar,
  TripledPageHeader,
  TripledResourceCard,
} from '@/components/tripled';
import { Button } from '@/components/ui/button';
import { LayoutDashboard, ShieldAlert, UserCircle } from 'lucide-react';
import Link from 'next/link';

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
          description="El acceso a esta sección depende de los permisos asignados a tu rol."
          icon={<ShieldAlert className="size-5" aria-hidden />}
        >
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Puedes volver al dashboard o revisar tu cuenta. Si eres usuario
              del sistema y esperabas ver datos de una empresa, selecciona una
              empresa en el menú superior; si el bloqueo continúa, solicita a un
              administrador que revise tu rol.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button asChild className="min-h-11 rounded-xl">
                <Link href="/dashboard">
                  <LayoutDashboard className="mr-2 h-4 w-4" aria-hidden />
                  Ir al dashboard
                </Link>
              </Button>
              <Button asChild variant="outline" className="min-h-11 rounded-xl">
                <Link href="/account">
                  <UserCircle className="mr-2 h-4 w-4" aria-hidden />
                  Ver mi cuenta
                </Link>
              </Button>
            </div>
          </div>
        </TripledResourceCard>
      </TripledDashboardShell>
    </>
  );
}
