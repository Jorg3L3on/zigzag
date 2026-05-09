import { getCompanies } from '@/actions/companies';
import { DataTable } from '@/components/ui/data-table';
import { columns } from '@/app/dashboard/companies/columns';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { CreateCompanyDialog } from '@/app/dashboard/companies/create-company-dialog';
import { TripledPageHeader } from '@/components/tripled';

export default async function CompaniesPage() {
  const result = await getCompanies();

  if (!result.success) {
    const errorMessage =
      result.errorType === 'network'
        ? 'No se pudieron cargar las empresas por problemas de conexión.'
        : result.error || 'Error al cargar las empresas';
    return <div>Error: {errorMessage}</div>;
  }

  return (
    <>
      <TripledPageHeader items={[{ label: 'Empresas' }]} />
      <div className="flex flex-1 flex-col gap-6 p-6">
        <div className="mx-auto w-full">
          <Card className="border-0 shadow-lg">
            <CardHeader className="space-y-4 pb-8">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <CardTitle className="text-xl">Empresas</CardTitle>
                  <CardDescription>
                    Lista de todas las empresas registradas
                  </CardDescription>
                </div>
                <CreateCompanyDialog />
              </div>
            </CardHeader>
            <CardContent>
              <DataTable columns={columns} data={result.data ?? []} />
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
