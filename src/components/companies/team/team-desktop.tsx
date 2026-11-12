'use client';

import * as React from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
} from '@tanstack/react-table';
import { Plus, Users } from 'lucide-react';

import {
  LIST_PAGE_SIZE,
  ListClickableRow,
  ListEmpty,
  ListFilterSelect,
  ListFooter,
  ListNoResults,
  ListTable,
  ListTableCard,
  ListToolbar,
  listColumnClassName,
  listFooterPagination,
} from '@/components/list-page';
import { Button } from '@/components/ui/button';
import { TableCell } from '@/components/ui/table';
import {
  filterTeamMembers,
  summarizeTeamRoles,
  TEAM_ACCESS_FILTERS,
  teamRoleLabel,
  type TeamAccessFilter,
  type TeamMember,
  type TeamRoleOption,
} from '@/lib/team-members';
import { createTeamColumns } from './team-columns';
import type { TeamMemberMenuHandlers } from './team-member-menu';

const ALL_ROLES = 'all';
const SEARCH_DEBOUNCE_MS = 300;

type TeamDesktopProps = {
  members: TeamMember[];
  deactivated: TeamMember[];
  roles: TeamRoleOption[];
  /** Null for readers: no add button, no row actions. */
  handlers: TeamMemberMenuHandlers | null;
  onAdd: () => void;
};

/**
 * Equipo from lg (ZIG-I32-2, canvas EmpEquipo) on the list standard (ZIG-I33-6):
 * a section title with the role breakdown, the filter row (search, Rol, Acceso,
 * Limpiar filtros), a Persona · Rol · Acceso · Alta table sorted by its headers,
 * with every row action in the ⋯, and «N de M personas» under it.
 */
export const TeamDesktop = ({
  members,
  deactivated,
  roles,
  handlers,
  onAdd,
}: TeamDesktopProps) => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [search, setSearch] = React.useState('');
  const [debouncedSearch, setDebouncedSearch] = React.useState('');
  // Roles › «Ver en Equipo» opens Equipo filtered by that role (?rol=<id>).
  const [roleFilter, setRoleFilterState] = React.useState<string>(() => {
    const requested = searchParams?.get('rol');
    return requested && roles.some((role) => String(role.id) === requested)
      ? requested
      : ALL_ROLES;
  });
  const [access, setAccess] = React.useState<TeamAccessFilter>('active');
  // Server order until a header is clicked (as before ZIG-I33).
  const [sorting, setSorting] = React.useState<SortingState>([]);

  React.useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedSearch(search), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timeout);
  }, [search]);

  /** The role filter is written to ?rol too, so a reload or a shared link keeps it. */
  const setRoleFilter = React.useCallback(
    (next: string) => {
      setRoleFilterState(next);
      const params = new URLSearchParams(searchParams?.toString() ?? '');
      if (next === ALL_ROLES) params.delete('rol');
      else params.set('rol', next);
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const everyone = React.useMemo(() => [...members, ...deactivated], [members, deactivated]);
  const rows = React.useMemo(
    () =>
      filterTeamMembers(everyone, {
        search: debouncedSearch,
        roleId: roleFilter === ALL_ROLES ? null : Number(roleFilter),
        access,
      }),
    [everyone, debouncedSearch, roleFilter, access],
  );
  const breakdown = summarizeTeamRoles(members);
  const hasActiveFilters = search.trim() !== '' || roleFilter !== ALL_ROLES || access !== 'active';

  const clearFilters = () => {
    setSearch('');
    setDebouncedSearch('');
    setAccess('active');
    if (roleFilter !== ALL_ROLES) setRoleFilter(ALL_ROLES);
  };

  const columns = React.useMemo(() => createTeamColumns(handlers), [handlers]);
  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    // Catalog lists page in the client at 25 once they pass it (ZIG-I33 §7).
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageIndex: 0, pageSize: LIST_PAGE_SIZE } },
  });
  const pagination = listFooterPagination(table, { pageSizes: false });
  const paged = pagination.pageCount > 1;

  const roleOptions = React.useMemo(
    () => [
      { value: ALL_ROLES, label: 'Todos los roles' },
      ...roles.map((role) => ({ value: String(role.id), label: teamRoleLabel(role.name) })),
    ],
    [roles],
  );

  return (
    // The column breakpoints (@min-[36rem], @min-[46rem]) measure this whole column.
    <div className="@container space-y-4" data-testid="team-desktop">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold">
            Equipo{' '}
            <span className="font-normal text-muted-foreground">
              · <span className="tabular-nums">{everyone.length}</span>
            </span>
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {breakdown ? `${breakdown}. ` : ''}Cada persona entra con su correo y una contraseña
            que tú le das.
          </p>
        </div>
        {handlers ? (
          <Button type="button" onClick={onAdd}>
            <Plus className="size-4" aria-hidden data-icon="inline-start" />
            Agregar persona
          </Button>
        ) : null}
      </div>

      <ListToolbar
        search={{
          value: search,
          onChange: setSearch,
          placeholder: 'Buscar por nombre o correo',
          ariaLabel: 'Buscar en el equipo',
        }}
        filters={
          <>
            <ListFilterSelect
              value={roleFilter}
              allValue={ALL_ROLES}
              onChange={setRoleFilter}
              options={roleOptions}
              ariaLabel="Filtrar por rol"
            />
            {/* Activos is the resting value; Todos (adds deactivated people) gets the tint. */}
            <ListFilterSelect
              value={access}
              allValue="active"
              onChange={setAccess}
              options={TEAM_ACCESS_FILTERS}
              ariaLabel="Filtrar por acceso"
            />
          </>
        }
        hasActiveFilters={hasActiveFilters}
        onClear={clearFilters}
      />

      {rows.length === 0 ? (
        everyone.length === 0 ? (
          <ListEmpty
            icon={<Users className="size-4 text-muted-foreground" aria-hidden />}
            title="Aún no hay nadie en tu equipo"
            description="Agrega a las personas que atienden tickets o administran la empresa."
          />
        ) : (
          <ListNoResults
            description="Nadie coincide con la búsqueda o los filtros."
            onClear={clearFilters}
          />
        )
      ) : (
        <ListTableCard
          footer={
            <ListFooter
              // «8 de 12 personas»: shown under the filters, of the whole team.
              total={paged ? rows.length : everyone.length}
              shown={paged ? undefined : rows.length}
              noun="personas"
              pagination={pagination}
            />
          }
        >
          <ListTable
            table={table}
            ariaLabel="Equipo"
            // Writers open an active person's edit panel from the row, like Editar in
            // the ⋯; deactivated rows and readers' rows open nothing (no ⋯ either).
            renderRow={(row) => (
              <ListClickableRow
                key={row.id}
                data-testid="team-member-row"
                onOpen={
                  handlers && !row.original.deactivated
                    ? () => handlers.onEdit(row.original)
                    : undefined
                }
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell
                    key={cell.id}
                    className={listColumnClassName(cell.column.columnDef.meta)}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </ListClickableRow>
            )}
          />
        </ListTableCard>
      )}
    </div>
  );
};
