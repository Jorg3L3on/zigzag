import { TripledPageHeader } from '@/components/tripled';
import { PermissionsList } from '@/components/permissions/permissions-list';
import { requirePagePermission } from '@/lib/page-authz';

export default async function PermissionsPage() {
  await requirePagePermission('permissions.read');

  return (
    <>
      <TripledPageHeader items={[{ label: 'Permisos' }]} />

      <div className="flex min-w-0 flex-1 flex-col gap-6 overflow-x-hidden p-4 sm:p-6">
        <div className="mx-auto w-full min-w-0">
          <PermissionsList />
        </div>
      </div>
    </>
  );
}
