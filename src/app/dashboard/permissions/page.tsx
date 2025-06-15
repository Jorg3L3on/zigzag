import { getPermissions } from '@/actions/permissions';
import { DataTable } from '@/components/ui/data-table';
import { columns } from '@/app/dashboard/permissions/columns';
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
import { CreatePermissionDialog } from '@/app/dashboard/permissions/create-permission-dialog';

export default async function PermissionsPage() {
  const { permissions } = await getPermissions();

  return (
    <>
      <header className="flex h-16 shrink-0 items-center gap-2">
        <div className="flex items-center gap-2 px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbPage>Permisos</BreadcrumbPage>
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
                  <CardTitle className="text-xl">Permisos</CardTitle>
                  <CardDescription>
                    Lista de todos los permisos registrados
                  </CardDescription>
                </div>
                <CreatePermissionDialog />
              </div>
            </CardHeader>
            <CardContent>
              <DataTable columns={columns} data={permissions ?? []} />
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
