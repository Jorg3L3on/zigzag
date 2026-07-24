import type { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ClientList } from '@/components/clients/client-list';
import { ClientsCsvToolbar } from '@/components/clients/clients-csv-toolbar';
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
        <TripledResourceCard
          title="Clientes"
          description="Contactos y datos clave del cliente."
          desktopDescription="Catálogo de clientes y datos de contacto"
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
          <div className="mb-4">
            <ClientsCsvToolbar canImport={canWriteClients} />
          </div>
          <ClientList />
        </TripledResourceCard>
      </TripledDashboardShell>
    </>
  );
}
