import { Metadata } from 'next';
import { CompanyForm } from '@/components/companies/company-form';
import { CompanyReadinessPanel } from '@/components/companies/company-readiness-panel';
import { assessCompanyReadiness } from '@/lib/company-readiness';
import {
  TripledDashboardShell,
  TripledMobileAppBar,
  TripledResourceCard,
} from '@/components/tripled';
import { getCompany } from '@/actions/companies';
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
import { requirePagePermission, requireSystemPage } from '@/lib/page-authz';
import { Building2 } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Editar empresa',
  description: 'Editar información de la empresa',
};

interface EditCompanyPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function EditCompanyPage({
  params,
}: EditCompanyPageProps) {
  await requirePagePermission('companies.write');
  await requireSystemPage();
  const { id } = await params;
  const numericId = Number.parseInt(id, 10);
  if (Number.isNaN(numericId)) {
    notFound();
  }

  const result = await getCompany(numericId);

  if (!result.success || !result.data) {
    notFound();
  }

  const companyRow = result.data;
  const readiness = assessCompanyReadiness(companyRow);

  return (
    <>
      <header className="hidden h-16 shrink-0 items-center gap-2 md:flex">
        <div className="flex items-center gap-2 px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem className="hidden md:block">
                <BreadcrumbLink href="/companies">
                  Empresas
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden md:block" />
              <BreadcrumbItem>
                <BreadcrumbPage>Editar empresa</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
      </header>

      <TripledDashboardShell maxWidthClassName="max-w-3xl">
        <TripledMobileAppBar
          title="Editar empresa"
          subtitle={companyRow.name}
          backHref="/companies"
          className="mb-3"
        />
        <TripledResourceCard
          title={companyRow.name}
          description="Actualiza datos generales, dirección y configuración."
          icon={<Building2 className="size-5" aria-hidden />}
        >
          <div className="space-y-6">
            <CompanyReadinessPanel assessment={readiness} />
            <CompanyForm
              company={companyRow}
              key={companyRow.logo ?? 'no-logo'}
            />
          </div>
        </TripledResourceCard>
      </TripledDashboardShell>
    </>
  );
}
