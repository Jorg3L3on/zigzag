'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronRight, Loader2, Lock, Plus, Shield } from 'lucide-react';

import {
  getCompanyRoles,
  type CompanyRoleSummary,
  type CompanyRolesData,
} from '@/actions/company-roles';
import { TripledEmptyState } from '@/components/tripled';
import { Button } from '@/components/ui/button';
import { COMPANY_HUB_ROLES_PATH } from '@/lib/company-hub';
import { summarizeMatrix, toMatrix } from '@/lib/role-matrix';
import { cn } from '@/lib/utils';
import { RoleEditor, type RoleEditorSeed } from './role-editor';

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; data: CompanyRolesData };

/** Loads the Roles tab data; shared by the workspace and the mobile editor routes. */
export const useCompanyRoles = () => {
  const [state, setState] = React.useState<LoadState>({ status: 'loading' });

  const load = React.useCallback(async () => {
    const result = await getCompanyRoles();
    if (result.success && result.data) {
      setState({ status: 'ready', data: result.data });
      return;
    }
    setState({
      status: 'error',
      message: result.error ?? 'No se pudieron cargar los roles.',
    });
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  return { state, reload: load, setState };
};

export const RolesLoadState = ({
  state,
  onRetry,
}: {
  state: Exclude<LoadState, { status: 'ready' }>;
  onRetry: () => void;
}) =>
  state.status === 'loading' ? (
    <div className="flex justify-center py-12" role="status">
      <Loader2 className="size-6 animate-spin text-muted-foreground" aria-hidden />
      <span className="sr-only">Cargando roles…</span>
    </div>
  ) : (
    <TripledEmptyState
      role="alert"
      icon={<Shield className="size-4" aria-hidden />}
      title="No se pudieron cargar los roles"
      description={state.message}
      action={
        <Button type="button" variant="outline" onClick={onRetry}>
          Reintentar
        </Button>
      }
    />
  );

const usersBadge = (count: number) => (count === 1 ? '1 usuario' : `${count} usuarios`);

const RoleListItem = ({
  role,
  selected,
  as,
  onSelect,
}: {
  role: CompanyRoleSummary;
  selected?: boolean;
  as: 'button' | 'link';
  onSelect?: () => void;
}) => {
  const body = (
    <>
      <span className="flex w-full items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1.5 font-semibold">
          <span className="truncate">{role.name}</span>
          {role.isGlobal ? (
            <Lock className="size-3.5 shrink-0 text-muted-foreground" aria-label="Rol compartido" />
          ) : null}
        </span>
        <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">
          {usersBadge(role.userCount)}
        </span>
      </span>
      <span className="line-clamp-2 text-left text-sm text-muted-foreground">
        {role.description || summarizeMatrix(toMatrix(role.permissionKeys))}
      </span>
    </>
  );
  const className = cn(
    'flex w-full flex-col gap-1 rounded-xl border px-3.5 py-3 text-left transition-colors',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
    selected ? 'border-primary bg-primary/10' : 'bg-card hover:bg-muted/50',
  );

  if (as === 'link') {
    return (
      <Link
        href={`${COMPANY_HUB_ROLES_PATH}/${role.id}`}
        className={cn(className, 'flex-row items-center gap-3')}
        data-testid="role-card"
      >
        <span className="flex min-w-0 flex-1 flex-col gap-1">{body}</span>
        <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      </Link>
    );
  }

  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={className}
      data-testid="role-list-item"
    >
      {body}
    </button>
  );
};

type Selection = { kind: 'role'; id: number } | { kind: 'new'; seed: RoleEditorSeed | null };

/** Roles tab (ZIG-I3-5): master-detail on md+, list + full-screen editor below. */
export const RolesWorkspace = () => {
  const router = useRouter();
  const { state, reload, setState } = useCompanyRoles();
  const [selection, setSelection] = React.useState<Selection | null>(null);
  // Bumped by Cancel so the editor remounts with the saved values.
  const [editorVersion, setEditorVersion] = React.useState(0);

  const data = state.status === 'ready' ? state.data : null;

  React.useEffect(() => {
    if (!data || selection) {
      return;
    }
    const first = data.roles[0];
    setSelection(first ? { kind: 'role', id: first.id } : { kind: 'new', seed: null });
  }, [data, selection]);

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
  const selectedRole =
    selection?.kind === 'role' ? roles.find((role) => role.id === selection.id) ?? null : null;

  const afterChange = async (nextSelection: Selection | null) => {
    await reload();
    setSelection(nextSelection);
    // Refresh the hub tab counts.
    router.refresh();
  };

  return (
    <>
      {/* Mobile: list; each role opens its own full-screen editor route */}
      <div className="space-y-2.5 md:hidden">
        {canWrite ? (
          <Button asChild variant="outline" className="h-11 w-full border-dashed border-primary text-primary">
            <Link href={`${COMPANY_HUB_ROLES_PATH}/nuevo`}>
              <Plus className="mr-2 size-4" aria-hidden />
              Nuevo rol
            </Link>
          </Button>
        ) : null}
        <ul className="space-y-2.5">
          {roles.map((role) => (
            <li key={role.id}>
              <RoleListItem role={role} as="link" />
            </li>
          ))}
        </ul>
      </div>

      {/* Desktop: master-detail */}
      <div className="hidden flex-wrap items-start gap-6 md:flex">
        <aside aria-label="Lista de roles" className="flex min-w-0 max-w-xs flex-[1_1_240px] flex-col gap-2.5">
          {canWrite ? (
            <Button
              type="button"
              variant="outline"
              className="h-10 border-dashed border-primary text-primary"
              aria-pressed={selection?.kind === 'new'}
              onClick={() => setSelection({ kind: 'new', seed: null })}
            >
              <Plus className="mr-2 size-4" aria-hidden />
              Nuevo rol
            </Button>
          ) : null}
          {roles.map((role) => (
            <RoleListItem
              key={role.id}
              role={role}
              as="button"
              selected={selection?.kind === 'role' && selection.id === role.id}
              onSelect={() => setSelection({ kind: 'role', id: role.id })}
            />
          ))}
        </aside>
        <div className="min-w-0 flex-[2_1_480px] rounded-xl border bg-card p-5">
          {selection === null ? null : (
            <RoleEditor
              key={`${selection.kind === 'role' ? `role-${selection.id}` : `new-${selection.seed?.name ?? ''}`}-${editorVersion}`}
              role={selectedRole}
              seed={selection.kind === 'new' ? selection.seed : null}
              canWrite={canWrite}
              variant="panel"
              onSaved={(id) => void afterChange({ kind: 'role', id })}
              onDeleted={() => void afterChange(null)}
              onCancel={() => {
                if (selection.kind === 'new') {
                  setSelection(roles[0] ? { kind: 'role', id: roles[0].id } : selection);
                }
                setEditorVersion((version) => version + 1);
              }}
              onDuplicate={(seed) => setSelection({ kind: 'new', seed })}
            />
          )}
        </div>
      </div>
    </>
  );
};
