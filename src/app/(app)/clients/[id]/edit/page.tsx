import { Metadata } from 'next';
import { ClientCreateShortcuts } from '@/components/clients/client-create-shortcuts';
import { ClientForm } from '@/components/clients/client-form';
import {
  TripledDashboardShell,
  TripledMobileAppBar,
  TripledResourceCard,
} from '@/components/tripled';
import { getClient } from '@/actions/clients';
import { notFound } from 'next/navigation';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { requirePagePermission } from '@/lib/page-authz';
import { UserRoundCog } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Editar cliente',
  description: 'Edita la información del cliente',
};

interface EditClientPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function EditClientPage({ params }: EditClientPageProps) {
  await requirePagePermission('clients.write');
  const { id } = await params;
  const result = await getClient(parseInt(id));

  if (!result.success || !result.data) {
    notFound();
  }

  return (
    <>
      <header className="hidden h-16 shrink-0 items-center gap-2 md:flex">
        <div className="flex items-center gap-2 px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem className="hidden md:block">
                <BreadcrumbLink href="/clients">
                  Clientes
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden md:block" />
              <BreadcrumbItem>
                <BreadcrumbPage>Editar cliente</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
      </header>

      <TripledDashboardShell maxWidthClassName="max-w-2xl" contentClassName="lg:flex lg:flex-col">
        <TripledMobileAppBar
          title="Editar cliente"
          subtitle={result.data.name}
          backHref="/clients"
          className="mb-3"
        />
        {/* From lg the shortcuts sit under the page title (ZIG-30). */}
        <ClientCreateShortcuts
          clientId={result.data.id}
          className="lg:order-1 lg:mb-5 lg:flex"
        />
        <TripledResourceCard
          desktop="page"
          contentClassName="lg:order-2"
          title="Información del cliente"
          description="Modifica la información del cliente."
          icon={<UserRoundCog className="size-5" aria-hidden />}
        >
          <ClientForm client={result.data} />
        </TripledResourceCard>
      </TripledDashboardShell>
    </>
  );
}
