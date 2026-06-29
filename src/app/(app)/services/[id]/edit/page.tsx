import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Wrench } from 'lucide-react';
import { getService } from '@/actions/services';
import { ServiceFormWithRedirect } from '@/components/services/service-form-with-redirect';
import { CompanyEntitlementNotice } from '@/components/companies/company-entitlement-notice';
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
import {
  TripledDashboardShell,
  TripledMobileAppBar,
  TripledResourceCard,
} from '@/components/tripled';
import { requirePagePermission } from '@/lib/page-authz';

export const metadata: Metadata = {
  title: 'Editar servicio',
  description: 'Edita o crea un servicio',
};

interface EditServicePageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function EditServicePage({ params }: EditServicePageProps) {
  await requirePagePermission('services.write');
  const { id } = await params;
  const isNew = id === 'new';

  if (isNew) {
    return (
      <>
        <header className="hidden h-16 shrink-0 items-center gap-2 md:flex">
          <div className="flex items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 h-4" />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink href="/services">Servicios</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage>Nuevo servicio</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
        </header>

        <TripledDashboardShell maxWidthClassName="max-w-2xl">
          <TripledMobileAppBar
            title="Nuevo servicio"
            subtitle="Catálogo"
            backHref="/services"
            className="mb-3"
          />
          <CompanyEntitlementNotice metric="services" />
          <TripledResourceCard
            title="Nuevo servicio"
            description="Completa los datos para crear un nuevo servicio."
            icon={<Wrench className="size-5" aria-hidden />}
          >
            <ServiceFormWithRedirect />
          </TripledResourceCard>
        </TripledDashboardShell>
      </>
    );
  }

  const serviceId = Number.parseInt(id, 10);
  if (Number.isNaN(serviceId)) {
    notFound();
  }

  const result = await getService(serviceId);
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
              <BreadcrumbItem>
                <BreadcrumbLink href="/services">Servicios</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>Editar servicio</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
      </header>

      <TripledDashboardShell maxWidthClassName="max-w-2xl">
        <TripledMobileAppBar
          title="Editar servicio"
          subtitle={result.data.name}
          backHref="/services"
          className="mb-3"
        />
        <TripledResourceCard
          title="Editar servicio"
          description="Modifica los datos del servicio."
          icon={<Wrench className="size-5" aria-hidden />}
        >
          <ServiceFormWithRedirect service={result.data} />
        </TripledResourceCard>
      </TripledDashboardShell>
    </>
  );
}
