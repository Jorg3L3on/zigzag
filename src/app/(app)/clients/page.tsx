import type { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ClientList } from '@/components/clients/client-list';
import { ClientsCsvImport } from '@/components/clients/clients-csv-import';
import { DesktopSwitch } from '@/components/desktop-switch';
import {
  TripledDashboardShell,
  TripledPageHeader,
  TripledResourceCard,
} from '@/components/tripled';
import { Plus, Users } from 'lucide-react';
import { requirePagePermission } from '@/lib/page-authz';
import { getSessionPermissionMap } from '@/actions/authz';
import { canAccessPermission, PERMISSIONS } from '@/lib/permissions';

export const metadata: Metadata = {
  title: 'Clientes',
  description: 'Administra tus clientes',
};

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function ClientsPage() {
  await requirePagePermission('clients.read');
  const permissionMap = await getSessionPermissionMap();
  const canWriteClients = canAccessPermission(
    permissionMap,
    PERMISSIONS.clients.write,
  );

  return (
    <>
      <TripledPageHeader items={[{ label: 'Clientes' }]} />

      <TripledDashboardShell>
        {/* From lg the list draws its own title row, without the card (ZIG-30). */}
        <TripledResourceCard
          className="lg:contents"
          headerClassName="lg:hidden"
          contentClassName="lg:bg-transparent lg:p-0 lg:pt-0"
          title="Clientes"
          description="Catálogo de clientes y datos de contacto"
          icon={<Users className="size-5" aria-hidden />}
          action={
            canWriteClients ? (
              <Button
                asChild
                className="min-h-11 w-full gap-1.5 rounded-xl bg-primary px-4 text-sm font-semibold shadow-sm hover:bg-primary/90 sm:w-auto sm:self-start"
              >
                <Link href="/clients/new">
                  <Plus
                    className="h-4 w-4 shrink-0"
                    aria-hidden
                    data-icon="inline-start"
                  />
                  Nuevo cliente
                </Link>
              </Button>
            ) : null
          }
        >
          {canWriteClients ? (
            <DesktopSwitch
              phone={
                <div className="mb-4">
                  <ClientsCsvImport />
                </div>
              }
              desktop={null}
            />
          ) : null}
          <ClientList
            desktopActions={
              canWriteClients ? (
                <>
                  <ClientsCsvImport buttonClassName="h-9 px-3" />
                  <Button asChild>
                    <Link href="/clients/new">
                      <Plus className="h-4 w-4 shrink-0" aria-hidden data-icon="inline-start" />
                      Nuevo cliente
                    </Link>
                  </Button>
                </>
              ) : null
            }
          />
        </TripledResourceCard>
      </TripledDashboardShell>
    </>
  );
}
