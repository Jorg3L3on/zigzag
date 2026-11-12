import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Building2 } from 'lucide-react';
import { CompanyForm } from '@/components/companies/company-form';
import { CompanyReadinessBanner } from '@/components/companies/company-readiness-banner';
import { assessCompanyReadiness } from '@/lib/company-readiness';
import { getOwnCompany } from '@/actions/companies';
import { db } from '@/lib/db';
import { readNextFolioNumbers } from '@/lib/folio-allocator';
import { requirePagePermission } from '@/lib/page-authz';
import { TripledResourceCard } from '@/components/tripled';
import { COMPANY_HUB_CARD_DESKTOP_RESET } from '@/lib/company-hub';

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
  const nextFolioNumbers = await readNextFolioNumbers(db, companyRow.id);

  // Phones and tablets keep the card; lg+ drops it for the hub header and Datos cards (ZIG-I32-1).
  return (
    <div className="w-full max-w-3xl lg:max-w-none">
      <TripledResourceCard
        title="Datos de la empresa"
        description="Actualiza datos generales, dirección, logo y configuración."
        icon={<Building2 className="size-5" aria-hidden />}
        {...COMPANY_HUB_CARD_DESKTOP_RESET}
      >
        <div className="space-y-6">
          <div className="lg:hidden">
            <CompanyReadinessBanner assessment={readiness} />
          </div>
          <CompanyForm
            company={companyRow}
            mode="self"
            nextFolioNumbers={nextFolioNumbers}
          />
        </div>
      </TripledResourceCard>
    </div>
  );
}
