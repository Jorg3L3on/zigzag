import { getCompanies } from '@/actions/companies';
import { DataTable } from '@/components/ui/data-table';
import { columns } from '@/app/dashboard/companies/columns';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from '@/components/ui/breadcrumb';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { CreateCompanyDialog } from '@/app/dashboard/companies/create-company-dialog';

export default async function CompaniesPage() {
  const { companies, error } = await getCompanies();

  if (error) {
    return <div>Error: {error}</div>;
  }

  return (
    <>
      <header className="flex h-16 shrink-0 items-center gap-2">
        <div className="flex items-center gap-2 px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbPage>Empresas</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
      </header>
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
              <DataTable columns={columns} data={companies ?? []} />
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
