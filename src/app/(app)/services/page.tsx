import { Button } from '@/components/ui/button';
import { Plus, Upload, Wrench } from 'lucide-react';
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
              <Button
                asChild
                className="min-h-11 w-full gap-1.5 rounded-xl bg-primary px-4 text-sm font-semibold shadow-sm hover:bg-primary/90 sm:w-auto sm:self-start"
              >
                <Link href="/services/new">
                  <Plus
                    className="h-4 w-4 shrink-0"
                    aria-hidden
                    data-icon="inline-start"
                  />
                  Nuevo servicio
                </Link>
              </Button>
            ) : null
          }
        >
          {canWriteServices ? (
            <div className="mb-4">
              <Button asChild variant="outline" size="sm" className="gap-1.5">
                <Link href="/services/import">
                  <Upload
                    className="size-4"
                    aria-hidden
                    data-icon="inline-start"
                  />
                  Importar CSV
                </Link>
              </Button>
            </div>
          ) : null}
          <ServicesListClient />
        </TripledResourceCard>
      </TripledDashboardShell>
    </>
  );
}
