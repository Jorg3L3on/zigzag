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
import { teamRoleLabel } from '@/lib/team-members';
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

/** Phones (ZIG-I3-5): each role links to its full-screen editor. */
const RoleListItem = ({ role }: { role: CompanyRoleSummary }) => {
  const body = (
    <>
      <span className="flex w-full items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1.5 font-semibold">
          <span className="truncate">{teamRoleLabel(role.name)}</span>
          {role.isGlobal ? (
            <Lock className="size-3.5 shrink-0 text-muted-foreground" aria-label="Rol compartido" />
          ) : null}
        </span>
        <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-caption font-semibold text-muted-foreground">
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
    'bg-card hover:bg-muted/50',
  );

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
};

/** One line per shared template on the md+ role cards (canvas EmpRoles). */
const SHARED_ROLE_CARD_HINTS: Record<string, string> = {
  Admin: 'Acceso completo',
  Operator: 'Tickets, clientes y servicios; sin administración',
  Viewer: 'Ve tickets, clientes y servicios',
};

const peopleBadge = (count: number) => (count === 1 ? '1 persona' : `${count} personas`);

/** md+ role card (ZIG-I32-3): name, people, description, «Plantilla de ZigZag» on shared roles. */
const RoleCard = ({
  role,
  selected,
  onSelect,
}: {
  role: CompanyRoleSummary;
  selected: boolean;
  onSelect: () => void;
}) => (
  <button
    type="button"
    aria-pressed={selected}
    onClick={onSelect}
    className={cn(
      'flex w-full flex-col gap-1 rounded-xl border bg-card px-3.5 py-3 text-left transition-colors',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
      selected ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'hover:bg-muted/50',
    )}
    data-testid="role-list-item"
  >
    <span className="flex w-full items-center justify-between gap-2">
      <span className="truncate font-semibold">
        {teamRoleLabel(role.name)}
      </span>
      <span
        className={cn(
          'shrink-0 text-caption tabular-nums',
          selected ? 'text-slate-600 dark:text-slate-300' : 'text-muted-foreground',
        )}
      >
        {peopleBadge(role.userCount)}
      </span>
    </span>
    <span
      className={cn(
        'line-clamp-2 text-sm',
        selected ? 'text-slate-600 dark:text-slate-300' : 'text-muted-foreground',
      )}
    >
      {(role.isGlobal ? SHARED_ROLE_CARD_HINTS[role.name] : null) ||
        role.description ||
        summarizeMatrix(toMatrix(role.permissionKeys))}
    </span>
    {role.isGlobal ? (
      <span className="mt-1 inline-flex w-fit rounded-full bg-muted px-2 py-0.5 text-caption font-semibold text-slate-600 dark:text-slate-300">
        Plantilla de ZigZag
      </span>
    ) : null}
  </button>
);

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
      <div className="space-y-2.5 lg:hidden">
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
              <RoleListItem role={role} />
            </li>
          ))}
        </ul>
      </div>

      {/* Desktop: header, role cards and the editor card (ZIG-I32-3) */}
      {/* @container: at 1024 with the sidebar open the hub column is ~500 px, so
          the cards go above the editor; side by side from 44rem (1280). */}
      <div className="@container hidden flex-col gap-4 lg:flex">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold">
              Roles <span className="font-normal text-muted-foreground">· {roles.length}</span>
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Qué puede ver y hacer cada persona. Editar incluye Ver; los cambios aplican en la
              siguiente acción.
            </p>
          </div>
          {canWrite ? (
            <Button
              type="button"
              className="shrink-0"
              aria-pressed={selection?.kind === 'new'}
              onClick={() => setSelection({ kind: 'new', seed: null })}
            >
              <Plus className="size-4" aria-hidden data-icon="inline-start" />
              Nuevo rol
            </Button>
          ) : null}
        </div>
        <div className="flex flex-col items-start gap-6 @min-[44rem]:flex-row">
          <aside
            aria-label="Lista de roles"
            className="grid w-full min-w-0 gap-2 @min-[28rem]:grid-cols-2 @min-[44rem]:flex @min-[44rem]:w-64 @min-[44rem]:shrink-0 @min-[44rem]:flex-col"
          >
            {roles.map((role) => (
              <RoleCard
                key={role.id}
                role={role}
                selected={selection?.kind === 'role' && selection.id === role.id}
                onSelect={() => setSelection({ kind: 'role', id: role.id })}
              />
            ))}
          </aside>
          <div className="w-full min-w-0 flex-1 rounded-xl border bg-card p-4 @min-[44rem]:p-6">
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
      </div>
    </>
  );
};
