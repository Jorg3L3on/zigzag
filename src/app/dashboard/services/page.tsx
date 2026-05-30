import { Button } from '@/components/ui/button';
import { Plus, Wrench } from 'lucide-react';
import Link from 'next/link';
import { ServicesListClient } from '@/components/services/services-list-client';
import {
  TripledDashboardShell,
  TripledPageHeader,
  TripledResourceCard,
} from '@/components/tripled';
import { requirePagePermission } from '@/lib/page-authz';
import { getSessionPermissionMap } from '@/actions/authz';
import { canAccessPermission, PERMISSIONS } from '@/lib/permissions';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function ServicesPage() {
  await requirePagePermission('services.read');
  const permissionMap = await getSessionPermissionMap();
  const canWriteServices = canAccessPermission(
    permissionMap,
    PERMISSIONS.services.write,
  );

  return (
    <>
      <TripledPageHeader items={[{ label: 'Servicios' }]} />

      <TripledDashboardShell>
        <TripledResourceCard
          title="Servicios"
          description="Catálogo de servicios y precios."
          desktopDescription="Administra el catálogo de servicios disponibles"
          icon={<Wrench className="size-5" aria-hidden />}
          action={
            canWriteServices ? (
              <Link
                href="/dashboard/services/new"
                className="w-full shrink-0 sm:w-auto sm:self-start"
              >
                <Button className="min-h-11 w-full gap-1.5 rounded-xl bg-primary px-4 text-sm font-semibold shadow-sm hover:bg-primary/90 sm:w-auto">
                  <Plus className="h-4 w-4 shrink-0" aria-hidden />
                  Nuevo Servicio
                </Button>
              </Link>
            ) : null
          }
        >
          <ServicesListClient />
        </TripledResourceCard>
      </TripledDashboardShell>
    </>
  );
}
