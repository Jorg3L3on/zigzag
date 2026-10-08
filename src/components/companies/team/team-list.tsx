'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
} from '@tanstack/react-table';
import { Loader2, Plus, Search, UserPlus, Users } from 'lucide-react';

import { getTeam, type TeamData } from '@/actions/team';
import { TripledEmptyState, TripledMobileStickyActionBar } from '@/components/tripled';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  filterTeamMembers,
  TEAM_STATUS_FILTERS,
  type TeamMember,
  type TeamStatusFilter,
} from '@/lib/team-members';
import { cn } from '@/lib/utils';
import {
  createTeamColumns,
  TeamAvatar,
  TeamRoleChip,
  TeamStatus,
} from './team-columns';
import { TeamDeactivateDialog } from './team-deactivate-dialog';
import { TeamMemberMenu, type TeamMemberMenuHandlers } from './team-member-menu';
import { TeamMemberSheet } from './team-member-sheet';
import { TeamRoleSheet } from './team-role-sheet';

const SEARCH_DEBOUNCE_MS = 200;

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; data: TeamData };

/** Equipo tab (ZIG-I3-4): the caller's company team, no company columns. */
export const TeamList = () => {
  const router = useRouter();
  const [state, setState] = React.useState<LoadState>({ status: 'loading' });
  const [searchValue, setSearchValue] = React.useState('');
  const [debouncedSearch, setDebouncedSearch] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<TeamStatusFilter>('all');
  const [sorting, setSorting] = React.useState<SortingState>([
    { id: 'usuario', desc: false },
  ]);
  const [addOpen, setAddOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<TeamMember | null>(null);
  const [changingRole, setChangingRole] = React.useState<TeamMember | null>(null);
  const [deactivating, setDeactivating] = React.useState<TeamMember | null>(null);

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
            onDeactivate: setDeactivating,
          }
        : null,
    [canWrite],
  );

  const members = React.useMemo(
    () =>
      data ? filterTeamMembers(data.members, debouncedSearch, statusFilter) : [],
    [data, debouncedSearch, statusFilter],
  );
  const columns = React.useMemo(() => createTeamColumns(handlers), [handlers]);

  const table = useReactTable({
    data: members,
    columns,
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

  const totalMembers = state.data.members.length;
  const addButtonLabel = 'Agregar usuario';

  return (
    <div className={cn('space-y-4', canWrite && 'pb-20 md:pb-0')}>
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
          aria-label="Filtrar por estado"
          className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1"
        >
          {TEAM_STATUS_FILTERS.map((option) => {
            const active = statusFilter === option.value;
            return (
              <Button
                key={option.value}
                type="button"
                variant={active ? 'default' : 'outline'}
                aria-pressed={active}
                className="h-10 shrink-0 rounded-full px-4"
                onClick={() => setStatusFilter(option.value)}
              >
                {option.label}
                {option.value === 'all' ? ` · ${totalMembers}` : null}
              </Button>
            );
          })}
        </div>
        {canWrite ? (
          <Button
            type="button"
            className="ml-auto hidden h-11 md:inline-flex"
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
              : 'Ajusta la búsqueda o el filtro de estado.'
          }
        />
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden overflow-x-auto rounded-xl border md:block">
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <TableHead
                        key={header.id}
                        className={cn(header.column.id === 'acciones' && 'w-14')}
                      >
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext(),
                            )}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id} data-testid="team-member-row">
                    {row.getVisibleCells().map((cell) => (
                      <TableCell
                        key={cell.id}
                        className={cn(cell.column.id === 'usuario' && 'max-w-xs')}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Mobile cards, same sorted order */}
          <ul className="space-y-2.5 md:hidden">
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
                        <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                          (tú)
                        </span>
                      ) : null}
                    </span>
                    <span className="truncate text-sm text-muted-foreground">
                      {member.email}
                    </span>
                    <span className="flex flex-wrap items-center gap-2">
                      <TeamRoleChip name={member.roleName} />
                      <TeamStatus member={member} />
                    </span>
                  </div>
                  {handlers ? <TeamMemberMenu member={member} {...handlers} /> : null}
                </li>
              );
            })}
          </ul>
        </>
      )}

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

      <TeamMemberSheet
        open={addOpen}
        onOpenChange={setAddOpen}
        roles={state.data.roles}
        onSaved={onSaved}
      />
      <TeamMemberSheet
        open={Boolean(editing)}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
        roles={state.data.roles}
        member={editing}
        onSaved={onSaved}
      />
      <TeamRoleSheet
        member={changingRole}
        roles={state.data.roles}
        onOpenChange={(open) => {
          if (!open) setChangingRole(null);
        }}
        onSaved={onSaved}
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
