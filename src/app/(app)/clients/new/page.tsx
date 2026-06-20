import { Metadata } from 'next';
import { ClientForm } from '@/components/clients/client-form';
import {
  TripledDashboardShell,
  TripledMobileAppBar,
  TripledResourceCard,
} from '@/components/tripled';
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
import { UserPlus } from 'lucide-react';
import { CompanyEntitlementNotice } from '@/components/companies/company-entitlement-notice';

export const metadata: Metadata = {
  title: 'Nuevo cliente',
  description: 'Crea un nuevo cliente',
};

export default async function NewClientPage() {
  await requirePagePermission('clients.write');

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
                <BreadcrumbPage>Nuevo cliente</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
      </header>

      <TripledDashboardShell maxWidthClassName="max-w-2xl">
        <TripledMobileAppBar
          title="Nuevo cliente"
          subtitle="Datos de contacto"
          backHref="/clients"
          className="mb-3"
        />
        <CompanyEntitlementNotice metric="clients" />
        <TripledResourceCard
          title="Información del cliente"
          description="Ingresa la información del nuevo cliente."
          icon={<UserPlus className="size-5" aria-hidden />}
        >
          <ClientForm />
        </TripledResourceCard>
      </TripledDashboardShell>
    </>
  );
}
