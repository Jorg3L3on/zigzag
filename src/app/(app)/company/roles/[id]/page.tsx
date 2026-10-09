import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { RoleEditorScreen } from '@/components/companies/roles/role-editor-screen';
import { requirePagePermission } from '@/lib/page-authz';

export const metadata: Metadata = {
  title: 'Editar rol · Mi empresa',
};

export default async function CompanyRoleEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePagePermission('roles.read');

  const { id } = await params;
  const roleId = Number(id);
  if (!Number.isInteger(roleId) || roleId < 1) {
    notFound();
  }

  return (
    <Suspense>
      <RoleEditorScreen roleId={roleId} />
    </Suspense>
  );
}
