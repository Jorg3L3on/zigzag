import { Metadata } from 'next';
import { Suspense } from 'react';
import { RoleEditorScreen } from '@/components/companies/roles/role-editor-screen';
import { requirePagePermission } from '@/lib/page-authz';

export const metadata: Metadata = {
  title: 'Nuevo rol · Mi empresa',
};

export default async function CompanyRoleNewPage() {
  await requirePagePermission('roles.write');

  return (
    <Suspense>
      <RoleEditorScreen roleId={null} />
    </Suspense>
  );
}
