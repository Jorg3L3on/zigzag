import { getPermissions } from '@/actions/permissions';
import { DataTable } from '@/components/ui/data-table';
import { columns } from '@/app/dashboard/permissions/columns';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { CreatePermissionDialog } from '@/app/dashboard/permissions/create-permission-dialog';
import { TripledPageHeader } from '@/components/tripled';

export default async function PermissionsPage() {
  const result = await getPermissions();

  if (!result.success) {
    const errorMessage =
      result.errorType === 'network'
        ? 'No se pudieron cargar los permisos por problemas de conexión.'
        : result.error || 'Error al cargar los permisos';
    return <div>Error: {errorMessage}</div>;
  }

  return (
    <>
      <TripledPageHeader items={[{ label: 'Permisos' }]} />
      <div className="flex flex-1 flex-col gap-6 p-6">
        <div className="mx-auto w-full">
          <Card className="border-0 shadow-lg">
            <CardHeader className="space-y-4 pb-8">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <CardTitle className="text-xl">Permisos</CardTitle>
                  <CardDescription>
                    Lista de todos los permisos registrados
                  </CardDescription>
                </div>
                <CreatePermissionDialog />
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
