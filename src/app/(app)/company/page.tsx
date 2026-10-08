import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Building2 } from 'lucide-react';
import { CompanyForm } from '@/components/companies/company-form';
import { CompanyReadinessPanel } from '@/components/companies/company-readiness-panel';
import { assessCompanyReadiness } from '@/lib/company-readiness';
import { getOwnCompany } from '@/actions/companies';
import { requirePagePermission } from '@/lib/page-authz';
import { TripledResourceCard } from '@/components/tripled';

export const metadata: Metadata = {
  title: 'Mi empresa',
  description: 'Configuración de la empresa',
};

export default async function CompanySettingsPage() {
  await requirePagePermission('company.manage');

  const result = await getOwnCompany();
  if (!result.success || !result.data) {
    notFound();
  }

  const companyRow = result.data;
  const readiness = assessCompanyReadiness(companyRow);

  return (
    <div className="w-full max-w-3xl">
      <TripledResourceCard
        title="Datos de la empresa"
        description="Actualiza datos generales, dirección, logo y configuración."
        icon={<Building2 className="size-5" aria-hidden />}
      >
        <div className="space-y-6">
          <CompanyReadinessPanel assessment={readiness} />
          <CompanyForm
            company={companyRow}
            mode="self"
            key={companyRow.logo ?? 'no-logo'}
          />
        </div>
      </TripledResourceCard>
    </div>
  );
}
