import { TripledPageHeader } from '@/components/tripled';
import { UsersList } from '@/components/users/users-list';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function UsersPage() {
  return (
    <>
      <TripledPageHeader items={[{ label: 'Usuarios' }]} />

      <div className="flex min-w-0 flex-1 flex-col gap-6 overflow-x-hidden p-4 sm:p-6">
        <div className="mx-auto w-full min-w-0">
          <UsersList />
        </div>
      </div>
    </>
  );
}
