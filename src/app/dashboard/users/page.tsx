import { getUsers } from '@/actions/users';
import { DataTable } from '@/components/ui/data-table';
import { columns } from '@/app/dashboard/users/columns';
import { CreateUserDialog } from '@/app/dashboard/users/create-user-dialog';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { TripledPageHeader } from '@/components/tripled';

export default async function UsersPage() {
  const result = await getUsers();

  if (!result.success) {
    const errorMessage =
      result.errorType === 'network'
        ? 'No se pudieron cargar los usuarios por problemas de conexión.'
        : result.error || 'Error al cargar los usuarios';
    return <div>Error: {errorMessage}</div>;
  }

  return (
    <>
      <TripledPageHeader items={[{ label: 'Usuarios' }]} />
      <div className="flex flex-1 flex-col gap-6 p-6">
        <div className="mx-auto w-full">
          <Card className="border-0 shadow-lg">
            <CardHeader className="space-y-4 pb-8">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <CardTitle className="text-xl">Usuarios</CardTitle>
                  <CardDescription>
                    Lista de todos los usuarios registrados
                  </CardDescription>
                </div>
                <CreateUserDialog />
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
