'use client';

import * as React from 'react';
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
} from '@tanstack/react-table';
import { getRoles } from '@/actions/roles';
import {
  TripledEmptyState,
  TripledListLoadingState,
  TripledMobileRecordCard,
} from '@/components/tripled';
import { Shield } from 'lucide-react';
import { resolveResourceListState } from '@/lib/resource-list-state';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { CreateRoleDialog } from '@/app/(app)/roles/create-role-dialog';
import { UpdateRoleDialog } from '@/app/(app)/roles/update-role-dialog';
import { DeleteRoleDialog } from '@/app/(app)/roles/delete-role-dialog';
import { createRolesColumns, type Role } from '@/components/roles/roles-columns';
import { RoleActionsMenu } from '@/components/roles/role-actions-menu';
import { classifyClientError, getErrorMessageByType } from '@/lib/network-awareness';
import { FormattedDate } from '@/components/formatted-date';
import {
  RolesFilterBar,
  type CompanyScopeFilter,
  type PermissionAssignmentFilter,
} from '@/components/roles/roles-filter-bar';
import { DEFAULT_ROLE_SORTING } from '@/components/roles/roles-sort-presets';
import { useOperatorTenantCompany } from '@/hooks/use-operator-tenant-company';
import { usePermissions } from '@/hooks/use-permissions';
import { PERMISSIONS } from '@/lib/permissions';

const countAssignedPermissions = (role: Role) =>
  role.permissions.filter((p) => p.permission != null).length;

export function RolesList() {
  const permissions = usePermissions();
  const { tenantCompanyId, tenantCompanyName, isTenantScoped } =
    useOperatorTenantCompany();
  // Tenant admins with roles.write manage their own company's roles; system
  // operators manage any company. `can` already returns true for operators.
  const canWriteRoles = permissions.can(PERMISSIONS.roles.write);
  const [roles, setRoles] = React.useState<Role[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [searchValue, setSearchValue] = React.useState('');
  const [debouncedSearch, setDebouncedSearch] = React.useState('');
  const [companyScopeFilter, setCompanyScopeFilter] =
    React.useState<CompanyScopeFilter>('all');
  const [permissionAssignmentFilter, setPermissionAssignmentFilter] =
    React.useState<PermissionAssignmentFilter>('all');
  const [sorting, setSorting] =
    React.useState<SortingState>(DEFAULT_ROLE_SORTING);
  const [editRole, setEditRole] = React.useState<Role | null>(null);
  const [deleteRole, setDeleteRole] = React.useState<Role | null>(null);

  React.useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSearch(searchValue.trim());
    }, 300);
    return () => window.clearTimeout(timeoutId);
  }, [searchValue]);

  const fetchRoles = React.useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const result = await getRoles();
      if (result.success && result.data) {
        setRoles(result.data as Role[]);
      } else {
        const errorType = classifyClientError(
          null,
          undefined,
          result.errorType,
        );
        setLoadError(
          getErrorMessageByType(
            errorType,
            result.error || 'No se pudieron cargar los roles',
          ),
        );
      }
    } catch (error) {
      console.error(error);
      const errorType = classifyClientError(error);
      setLoadError(
        getErrorMessageByType(errorType, 'No se pudieron cargar los roles'),
      );
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchRoles();
  }, [fetchRoles]);

  const filteredRoles = React.useMemo(() => {
    const q = debouncedSearch.toLowerCase();
    return roles.filter((roleRow) => {
      const matchesSearch =
        !q ||
        roleRow.name.toLowerCase().includes(q) ||
        (roleRow.description ?? '').toLowerCase().includes(q) ||
        (roleRow.company?.name ?? '').toLowerCase().includes(q) ||
        roleRow.permissions.some((p) =>
          (p.permission?.name ?? '').toLowerCase().includes(q),
        );

      if (!matchesSearch) {
        return false;
      }

      if (companyScopeFilter === 'global' && roleRow.company != null) {
        return false;
      }
      if (companyScopeFilter === 'company' && roleRow.company == null) {
        return false;
      }

      const n = countAssignedPermissions(roleRow);
      if (permissionAssignmentFilter === 'with' && n === 0) {
        return false;
      }
      if (permissionAssignmentFilter === 'without' && n > 0) {
        return false;
      }

      if (tenantCompanyId != null && roleRow.company?.id !== tenantCompanyId) {
        return false;
      }

      return true;
    });
  }, [
    roles,
    debouncedSearch,
    companyScopeFilter,
    permissionAssignmentFilter,
    tenantCompanyId,
  ]);

  const openEdit = React.useCallback((roleRow: Role) => {
    setEditRole(roleRow);
  }, []);

  const columns = React.useMemo(
    () =>
      createRolesColumns({
        renderActions: (roleRow) =>
          canWriteRoles ? (
          <RoleActionsMenu
            onEditRequest={() => openEdit(roleRow)}
            onDeleteRequest={() => setDeleteRole(roleRow)}
          />
          ) : null,
      }),
    [openEdit, canWriteRoles],
  );

  const table = useReactTable({
    data: filteredRoles,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getRowId: (row) => String(row.id),
  });

  const hasActiveFilters =
    debouncedSearch !== '' ||
    companyScopeFilter !== 'all' ||
    permissionAssignmentFilter !== 'all';
  const sheetFilterCount =
    Number(companyScopeFilter !== 'all') +
    Number(permissionAssignmentFilter !== 'all');
  const listState = resolveResourceListState({
    isLoading: loading,
    loadError,
    totalCount: roles.length,
    visibleCount: filteredRoles.length,
    hasActiveFilters,
  });

  const handleClearFilters = () => {
    setSearchValue('');
    setDebouncedSearch('');
    setCompanyScopeFilter('all');
    setPermissionAssignmentFilter('all');
    setSorting(DEFAULT_ROLE_SORTING);
  };

  const filterChips = [
    {
      key: 'count',
      label: `${filteredRoles.length} de ${roles.length} roles`,
      variant: 'secondary' as const,
    },
    ...(debouncedSearch
      ? [{ key: 'search', label: `Búsqueda: ${debouncedSearch}` }]
      : []),
    ...(companyScopeFilter !== 'all'
      ? [
          {
            key: 'scope',
            label:
              companyScopeFilter === 'global' ? 'Sin empresa' : 'Por empresa',
          },
        ]
      : []),
    ...(permissionAssignmentFilter !== 'all'
      ? [
          {
            key: 'permissions',
            label:
              permissionAssignmentFilter === 'with'
                ? 'Con permisos'
                : 'Sin permisos',
          },
        ]
      : []),
  ];

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        {canWriteRoles ? (
          <CreateRoleDialog
            onCreated={fetchRoles}
            defaultCompanyId={tenantCompanyId ?? undefined}
            defaultCompanyName={tenantCompanyName ?? undefined}
            lockCompany={isTenantScoped}
          />
        ) : null}
      </div>

      <RolesFilterBar
        searchValue={searchValue}
        onSearchChange={setSearchValue}
        companyScopeFilter={companyScopeFilter}
        onCompanyScopeFilterChange={setCompanyScopeFilter}
        permissionAssignmentFilter={permissionAssignmentFilter}
        onPermissionAssignmentFilterChange={setPermissionAssignmentFilter}
        sorting={sorting}
        onSortingChange={setSorting}
        sheetFilterCount={sheetFilterCount}
        hasActiveFilters={hasActiveFilters}
        onClearFilters={handleClearFilters}
        filterChips={filterChips}
      />

        {listState.kind === 'loading' ? (
          <TripledListLoadingState
            label="Cargando lista de roles"
            desktopColumns={5}
            desktopRows={5}
          />
        ) : listState.kind === 'error' ? (
          <TripledEmptyState
            icon={<Shield className="h-4 w-4" />}
            title="Error de carga"
            description={listState.message}
            role="alert"
            action={
              <Button type="button" variant="outline" onClick={fetchRoles}>
                Reintentar
              </Button>
            }
          />
        ) : listState.kind === 'empty' ? (
          <TripledEmptyState
            icon={<Shield className="h-4 w-4" />}
            title="Sin roles"
            description={
              canWriteRoles
                ? 'Crea el primer rol para agrupar permisos y asignarlo a usuarios.'
                : 'No hay roles registrados.'
            }
            action={
              canWriteRoles ? (
                <CreateRoleDialog
                  onCreated={fetchRoles}
                  defaultCompanyId={tenantCompanyId ?? undefined}
                  defaultCompanyName={tenantCompanyName ?? undefined}
                  lockCompany={isTenantScoped}
                />
              ) : null
            }
          />
        ) : listState.kind === 'filtered-empty' ? (
          <TripledEmptyState
            icon={<Shield className="h-4 w-4" />}
            title="Sin resultados"
            description="No hay roles que coincidan con la búsqueda o los filtros."
            action={
              <Button type="button" variant="outline" onClick={handleClearFilters}>
                Limpiar filtros
              </Button>
            }
          />
        ) : (
          <>
            <div className="space-y-3 md:hidden">
              {table.getRowModel().rows.map((row) => {
                const roleRow = row.original;
                return (
                  <TripledMobileRecordCard
                    key={row.id}
                    interactive={canWriteRoles}
                    tabIndex={canWriteRoles ? 0 : -1}
                    role="button"
                    aria-label={
                      canWriteRoles ? `Editar rol ${roleRow.name}` : `Rol ${roleRow.name}`
                    }
                    onClick={() => {
                      if (canWriteRoles) {
                        openEdit(roleRow);
                      }
                    }}
                    onKeyDown={(event) => {
                      if (
                        canWriteRoles &&
                        (event.key === 'Enter' || event.key === ' ')
                      ) {
                        event.preventDefault();
                        openEdit(roleRow);
                      }
                    }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 space-y-1">
                        <h3 className="text-sm font-semibold text-foreground">
                          {roleRow.name}
                        </h3>
                        <p className="line-clamp-2 text-sm text-muted-foreground">
                          {roleRow.description || '—'}
                        </p>
                      </div>
                      {canWriteRoles ? (
                        <div
                          onPointerDown={(event) => event.stopPropagation()}
                        >
                        <RoleActionsMenu
                          onEditRequest={() => openEdit(roleRow)}
                          onDeleteRequest={() => setDeleteRole(roleRow)}
                        />
                        </div>
                      ) : null}
                    </div>
                    <dl className="mt-3 space-y-2 text-sm">
                      <div className="grid grid-cols-[88px_1fr] gap-2">
                        <dt className="text-muted-foreground">Empresa</dt>
                        <dd className="truncate">
                          {roleRow.company?.name ?? 'Sin empresa'}
                        </dd>
                      </div>
                      <div className="grid grid-cols-[88px_1fr] gap-2">
                        <dt className="text-muted-foreground">Creado</dt>
                        <dd>
                          <FormattedDate date={roleRow.created_at} />
                        </dd>
                      </div>
                    </dl>
                    <div className="mt-3 flex flex-wrap gap-1">
                      {roleRow.permissions.map(({ permission }) =>
                        permission ? (
                          <Badge key={permission.id} variant="secondary">
                            {permission.name}
                          </Badge>
                        ) : null,
                      )}
                    </div>
                  </TripledMobileRecordCard>
                );
              })}
            </div>

            <div className="hidden overflow-x-auto md:block">
              <div className="rounded-xl border border-border/70 shadow-sm">
                <Table
                  className={
                    '[&_td]:py-2.5 [&_th]:h-10 [&_th]:py-2 [&_th]:align-middle [&_tr]:border-border/60'
                  }
                >
                  <TableHeader>
                    {table.getHeaderGroups().map((headerGroup) => (
                      <TableRow key={headerGroup.id}>
                        {headerGroup.headers.map((header) => (
                          <TableHead
                            key={header.id}
                            className={
                              header.column.id === 'actions'
                                ? 'text-right'
                                : undefined
                            }
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
                    {table.getRowModel().rows.map((row) => (
                      <TableRow
                        key={row.id}
                        className={canWriteRoles ? 'cursor-pointer' : undefined}
                        tabIndex={canWriteRoles ? 0 : -1}
                        aria-label={
                          canWriteRoles
                            ? `Editar rol ${row.original.name}`
                            : `Rol ${row.original.name}`
                        }
                        onClick={() => {
                          if (canWriteRoles) {
                            openEdit(row.original);
                          }
                        }}
                        onKeyDown={(event) => {
                          if (
                            canWriteRoles &&
                            (event.key === 'Enter' || event.key === ' ')
                          ) {
                            event.preventDefault();
                            openEdit(row.original);
                          }
                        }}
                      >
                        {row.getVisibleCells().map((cell) => (
                          <TableCell
                            key={cell.id}
                            className={
                              cell.column.id === 'actions'
                                ? 'text-right'
                                : undefined
                            }
                          >
                            {flexRender(
                              cell.column.columnDef.cell,
                              cell.getContext(),
                            )}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </>
        )}
      {editRole ? (
        <UpdateRoleDialog
          role={editRole}
          open
          onOpenChange={(open) => {
            if (!open) {
              setEditRole(null);
            }
          }}
          onSuccess={fetchRoles}
        />
      ) : null}
      {deleteRole ? (
        <DeleteRoleDialog
          role={deleteRole}
          open
          onOpenChange={(open) => {
            if (!open) {
              setDeleteRole(null);
            }
          }}
          onSuccess={fetchRoles}
        />
      ) : null}
    </div>
  );
}
