import { TripledPageHeader } from '@/components/tripled';
import { RolesList } from '@/components/roles/roles-list';
import { requirePagePermission } from '@/lib/page-authz';

export default async function RolesPage() {
  await requirePagePermission('roles.read');

  return (
    <>
      <TripledPageHeader items={[{ label: 'Roles' }]} />

      <div className="flex min-w-0 flex-1 flex-col gap-6 overflow-x-hidden p-4 sm:p-6">
        <div className="mx-auto w-full min-w-0">
          <RolesList />
        </div>
      </div>
    </>
  );
}
