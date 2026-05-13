import { TripledPageHeader } from '@/components/tripled';
import { CompaniesList } from '@/components/companies/companies-list';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function CompaniesPage() {
  return (
    <>
      <TripledPageHeader items={[{ label: 'Empresas' }]} />

      <div className="flex min-w-0 flex-1 flex-col gap-6 overflow-x-hidden p-4 sm:p-6">
        <div className="mx-auto w-full min-w-0">
          <CompaniesList />
        </div>
      </div>
    </>
  );
}
