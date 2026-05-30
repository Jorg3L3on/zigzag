import { Metadata } from 'next';
import { CompanyForm } from '@/components/companies/company-form';
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
import { requirePagePermission, requireSystemPage } from '@/lib/page-authz';
import { Building2 } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Nueva empresa',
  description: 'Registrar una nueva empresa',
};

export default async function NewCompanyPage() {
  await requirePagePermission('companies.write');
  await requireSystemPage();

  return (
    <>
      <header className="hidden h-16 shrink-0 items-center gap-2 md:flex">
        <div className="flex items-center gap-2 px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem className="hidden md:block">
                <BreadcrumbLink href="/dashboard/companies">
                  Empresas
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden md:block" />
              <BreadcrumbItem>
                <BreadcrumbPage>Nueva empresa</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
      </header>

      <TripledDashboardShell maxWidthClassName="max-w-3xl">
        <TripledMobileAppBar
          title="Nueva empresa"
          subtitle="Datos fiscales y contacto"
          backHref="/dashboard/companies"
          className="mb-3"
        />
        <TripledResourceCard
          title="Nueva empresa"
          description="Datos generales, dirección y configuración fiscal."
          icon={<Building2 className="size-5" aria-hidden />}
        >
          <CompanyForm />
        </TripledResourceCard>
      </TripledDashboardShell>
    </>
  );
}
