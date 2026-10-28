'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table';
import { Loader2, Plus, Search, UserPlus, Users } from 'lucide-react';

import { getTeam, resetTeamMemberPassword, type TeamData } from '@/actions/team';
import { DesktopSwitch } from '@/components/desktop-switch';
import { FILTER_SELECTED_CLASS } from '@/components/list-page';
import { TemporaryPasswordDialog } from '@/components/users/temporary-password-dialog';
import { TripledEmptyState, TripledMobileStickyActionBar } from '@/components/tripled';
import { Button } from '@/components/ui/button';
import { useIsDesktop } from '@/hooks/use-desktop';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import {
  filterTeamMembers,
  TEAM_ACCESS_FILTERS,
  type TeamAccessFilter,
  type TeamMember,
} from '@/lib/team-members';
import { TeamAccessPill, TeamAvatar, TeamRolePill } from './team-columns';
import { TeamDeactivateDialog } from './team-deactivate-dialog';
import { TeamMemberMenu, type TeamMemberMenuHandlers } from './team-member-menu';
import { TeamDesktop } from './team-desktop';
import { TeamMemberPanel } from './team-member-panel';
import { TeamMemberSheet } from './team-member-sheet';
import { TeamRoleSheet } from './team-role-sheet';

const SEARCH_DEBOUNCE_MS = 200;

/** The phone cards only sort by name (TanStack's text order, as before ZIG-I33). */
const PHONE_COLUMNS: ColumnDef<TeamMember>[] = [{ id: 'usuario', accessorKey: 'name' }];

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; data: TeamData };

/** Equipo tab (ZIG-I3-4): the caller's company team, no company columns. */
export const TeamList = () => {
  const router = useRouter();
  const isDesktop = useIsDesktop();
  const [state, setState] = React.useState<LoadState>({ status: 'loading' });
  const [searchValue, setSearchValue] = React.useState('');
  const [debouncedSearch, setDebouncedSearch] = React.useState('');
  const [accessFilter, setAccessFilter] = React.useState<TeamAccessFilter>('active');
  const [sorting, setSorting] = React.useState<SortingState>([
    { id: 'usuario', desc: false },
  ]);
  const [addOpen, setAddOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<TeamMember | null>(null);
  const [changingRole, setChangingRole] = React.useState<TeamMember | null>(null);
  const [deactivating, setDeactivating] = React.useState<TeamMember | null>(null);
  const [resetting, setResetting] = React.useState<TeamMember | null>(null);

  const load = React.useCallback(async () => {
    const result = await getTeam();
    if (result.success && result.data) {
      setState({ status: 'ready', data: result.data });
      return;
    }
    setState({
      status: 'error',
      message: result.error ?? 'No se pudo cargar el equipo.',
    });
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  React.useEffect(() => {
    const timeout = window.setTimeout(
      () => setDebouncedSearch(searchValue),
      SEARCH_DEBOUNCE_MS,
    );
    return () => window.clearTimeout(timeout);
  }, [searchValue]);

  const onSaved = React.useCallback(() => {
    void load();
    // Refresh the hub counts in the layout.
    router.refresh();
  }, [load, router]);

  const data = state.status === 'ready' ? state.data : null;
  const canWrite = Boolean(data?.canWrite);

  const handlers = React.useMemo<TeamMemberMenuHandlers | null>(
    () =>
      canWrite
        ? {
            onEdit: setEditing,
            onChangeRole: setChangingRole,
            onResetPassword: setResetting,
            onDeactivate: setDeactivating,
          }
        : null,
    [canWrite],
  );

  const members = React.useMemo(
    () =>
      data
        ? filterTeamMembers([...data.members, ...data.deactivated], {
            search: debouncedSearch,
            roleId: null,
            access: accessFilter,
          })
        : [],
    [data, debouncedSearch, accessFilter],
  );
  const table = useReactTable({
    data: members,
    columns: PHONE_COLUMNS,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });
  const rows = table.getRowModel().rows;

  if (state.status === 'loading') {
    return (
      <div className="flex justify-center py-12" role="status">
        <Loader2 className="size-6 animate-spin text-muted-foreground" aria-hidden />
        <span className="sr-only">Cargando equipo…</span>
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <TripledEmptyState
        role="alert"
        icon={<Users className="size-4" aria-hidden />}
        title="No se pudo cargar el equipo"
        description={state.message}
        action={
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setState({ status: 'loading' });
              void load();
            }}
          >
            Reintentar
          </Button>
        }
      />
    );
  }

  const totalMembers = state.data.members.length + state.data.deactivated.length;
  const addButtonLabel = 'Agregar persona';

  // Phones and tablets below lg (ZIG-I3-4); from lg TeamDesktop (ZIG-I32-2, ZIG-I33-6).
  const phone = (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <label className="relative min-w-0 flex-1 basis-64">
          <span className="sr-only">Buscar en el equipo</span>
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={searchValue}
            onChange={(event) => setSearchValue(event.target.value)}
            placeholder="Buscar por nombre, correo o rol"
            className="h-11 pl-9"
            type="search"
          />
        </label>
        <div
          role="group"
          aria-label="Filtrar por acceso"
          className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1"
        >
          {TEAM_ACCESS_FILTERS.map((option) => {
            const active = accessFilter === option.value;
            return (
              <Button
                key={option.value}
                type="button"
                variant="outline"
                aria-pressed={active}
                // A chosen filter is a tint, never the solid blue of the page action (eb0ff213).
                className={cn('h-10 shrink-0 rounded-full px-4', active && FILTER_SELECTED_CLASS)}
                onClick={() => setAccessFilter(option.value)}
              >
                {option.label}
                {option.value === 'all' ? ` · ${totalMembers}` : null}
              </Button>
            );
          })}
        </div>
        {canWrite ? (
          // Tablets: the phone sticky bar hides from md.
          <Button
            type="button"
            className="ml-auto hidden h-11 md:inline-flex lg:hidden"
            onClick={() => setAddOpen(true)}
          >
            <Plus className="mr-2 size-4" aria-hidden />
            {addButtonLabel}
          </Button>
        ) : null}
      </div>

      {rows.length === 0 ? (
        <TripledEmptyState
          icon={<Users className="size-4" aria-hidden />}
          title={totalMembers === 0 ? 'Aún no hay nadie en tu equipo' : 'Sin resultados'}
          description={
            totalMembers === 0
              ? 'Agrega a las personas que atienden tickets o administran la empresa.'
              : 'Ajusta la búsqueda o el filtro de acceso.'
          }
        />
      ) : (
        <ul className="space-y-2.5">
          {rows.map((row) => {
            const member = row.original;
            return (
              <li
                key={row.id}
                data-testid="team-member-card"
                className="flex items-center gap-3 rounded-2xl border bg-card p-3.5"
              >
                <TeamAvatar name={member.name} />
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="truncate font-semibold">
                    {member.name}
                    {member.isSelf ? (
                      <span className="ml-1.5 text-caption font-normal text-muted-foreground">
                        (tú)
                      </span>
                    ) : null}
                  </span>
                  <span className="truncate text-sm text-muted-foreground">
                    {member.email}
                  </span>
                  <span className="flex flex-wrap items-center gap-2">
                    <TeamRolePill name={member.roleName} />
                    <TeamAccessPill member={member} />
                  </span>
                </div>
                {handlers && !member.deactivated ? (
                  <TeamMemberMenu member={member} {...handlers} />
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );

  return (
    <div className="space-y-4">
      <DesktopSwitch
        phone={phone}
        phoneClassName="space-y-4"
        desktop={
          <TeamDesktop
            members={state.data.members}
            deactivated={state.data.deactivated}
            roles={state.data.roles}
            handlers={handlers}
            onAdd={() => setAddOpen(true)}
          />
        }
      />

      {canWrite ? (
        <TripledMobileStickyActionBar>
          <Button
            type="button"
            className="h-12 w-full text-base"
            onClick={() => setAddOpen(true)}
          >
            <UserPlus className="mr-2 size-5" aria-hidden />
            {addButtonLabel}
          </Button>
        </TripledMobileStickyActionBar>
      ) : null}

      {!isDesktop ? (
        <>
          <TeamMemberSheet
            open={addOpen}
            onOpenChange={setAddOpen}
            roles={state.data.roles}
            companyName={state.data.companyName}
            onSaved={onSaved}
          />
          <TeamMemberSheet
            open={Boolean(editing)}
            onOpenChange={(open) => {
              if (!open) setEditing(null);
            }}
            roles={state.data.roles}
            member={editing}
            companyName={state.data.companyName}
            onSaved={onSaved}
          />
        </>
      ) : (
        <TeamMemberPanel
          open={addOpen || Boolean(editing)}
          onOpenChange={(open) => {
            if (!open) {
              setAddOpen(false);
              setEditing(null);
            }
          }}
          roles={state.data.roles}
          member={editing}
          companyName={state.data.companyName}
          onSaved={onSaved}
        />
      )}
      <TeamRoleSheet
        member={changingRole}
        roles={state.data.roles}
        onOpenChange={(open) => {
          if (!open) setChangingRole(null);
        }}
        onSaved={onSaved}
      />
      <TemporaryPasswordDialog
        target={resetting}
        onReset={() => (resetting ? resetTeamMemberPassword(resetting.id) : Promise.resolve({ success: false }))}
        onOpenChange={(open) => {
          if (!open) setResetting(null);
        }}
        onDone={onSaved}
        actionLabel={isDesktop ? 'Restablecer contraseña' : undefined}
      />
      <TeamDeactivateDialog
        member={deactivating}
        onOpenChange={(open) => {
          if (!open) setDeactivating(null);
        }}
        onDeactivated={onSaved}
      />
    </div>
  );
};
