import { getRoles } from '@/actions/roles';
import { DataTable } from '@/components/ui/data-table';
import { columns } from '@/app/dashboard/roles/columns';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { CreateRoleDialog } from '@/app/dashboard/roles/create-role-dialog';
import { TripledPageHeader } from '@/components/tripled';

export default async function RolesPage() {
  const result = await getRoles();

  if (!result.success) {
    const errorMessage =
      result.errorType === 'network'
        ? 'No se pudieron cargar los roles por problemas de conexión.'
        : result.error || 'Error al cargar los roles';
    return <div>Error: {errorMessage}</div>;
  }

  return (
    <>
      <TripledPageHeader items={[{ label: 'Roles' }]} />
      <div className="flex flex-1 flex-col gap-6 p-6">
        <div className="mx-auto w-full">
          <Card className="border-0 shadow-lg">
            <CardHeader className="space-y-4 pb-8">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <CardTitle className="text-xl">Roles</CardTitle>
                  <CardDescription>
                    Lista de todos los roles registrados
                  </CardDescription>
                </div>
                <CreateRoleDialog />
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
