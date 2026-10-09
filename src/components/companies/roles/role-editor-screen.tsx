'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Shield } from 'lucide-react';

import { TripledEmptyState } from '@/components/tripled';
import { Button } from '@/components/ui/button';
import { COMPANY_HUB_ROLES_PATH } from '@/lib/company-hub';
import { RoleEditor } from './role-editor';
import { RolesLoadState, useCompanyRoles } from './roles-workspace';

type RoleEditorScreenProps = {
  /** null for /company/roles/nuevo. */
  roleId: number | null;
};

/** Full-screen role editor route (mobile flow; also works on desktop). */
export const RoleEditorScreen = ({ roleId }: RoleEditorScreenProps) => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { state, reload, setState } = useCompanyRoles();

  const backToList = () => {
    router.push(COMPANY_HUB_ROLES_PATH);
    router.refresh();
  };

  if (state.status !== 'ready') {
    return (
      <RolesLoadState
        state={state}
        onRetry={() => {
          setState({ status: 'loading' });
          void reload();
        }}
      />
    );
  }

  const { roles, canWrite } = state.data;
  const role = roleId === null ? null : roles.find((item) => item.id === roleId) ?? null;

  if (roleId !== null && !role) {
    return (
      <TripledEmptyState
        icon={<Shield className="size-4" aria-hidden />}
        title="Rol no encontrado"
        description="Puede que lo hayan eliminado."
        action={
          <Button type="button" variant="outline" onClick={backToList}>
            Volver a roles
          </Button>
        }
      />
    );
  }

  // Duplicar from a shared role: /company/roles/nuevo?desde=<id>
  const source = roles.find((item) => item.id === Number(searchParams.get('desde')));
  const seed =
    roleId === null && source
      ? {
          name: `${source.name} (copia)`,
          description: source.description ?? '',
          permissionKeys: source.permissionKeys,
        }
      : null;

  return (
    <RoleEditor
      role={role}
      seed={seed}
      canWrite={canWrite}
      variant="page"
      onSaved={backToList}
      onDeleted={backToList}
      onCancel={() => router.push(COMPANY_HUB_ROLES_PATH)}
      onDuplicate={() => {
        if (role) {
          router.push(`${COMPANY_HUB_ROLES_PATH}/nuevo?desde=${role.id}`);
        }
      }}
    />
  );
};
