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
import { TripledDataPanel, TripledEmptyState } from '@/components/tripled';
import { Loader2, Shield } from 'lucide-react';
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
import { CreateRoleDialog } from '@/app/dashboard/roles/create-role-dialog';
import { UpdateRoleDialog } from '@/app/dashboard/roles/update-role-dialog';
import { DeleteRoleDialog } from '@/app/dashboard/roles/delete-role-dialog';
import { createRolesColumns, type Role } from '@/components/roles/roles-columns';
import { RoleActionsMenu } from '@/components/roles/role-actions-menu';
import { classifyClientError, getErrorMessageByType } from '@/lib/network-awareness';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { FormattedDate } from '@/components/formatted-date';
import {
  DEFAULT_ROLE_SORTING,
  ROLES_MOBILE_SORT_OPTIONS,
  decodeSortingState,
  encodeSortingState,
} from '@/components/roles/roles-sort-presets';
import { usePermissions } from '@/hooks/use-permissions';
import { PERMISSIONS } from '@/lib/permissions';

type CompanyScopeFilter = 'all' | 'global' | 'company';
type PermissionAssignmentFilter = 'all' | 'with' | 'without';

const countAssignedPermissions = (role: Role) =>
  role.permissions.filter((p) => p.permission != null).length;

export function RolesList() {
  const permissions = usePermissions();
  const canWriteRoles =
    permissions.isSystem && permissions.can(PERMISSIONS.roles.write);
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

      return true;
    });
  }, [roles, debouncedSearch, companyScopeFilter, permissionAssignmentFilter]);

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

  const mobileSortValue = encodeSortingState(sorting);

  const companyScopeOptions: Array<{ value: CompanyScopeFilter; label: string }> =
    [
      { value: 'all', label: 'Todas las empresas' },
      { value: 'global', label: 'Sin empresa' },
      { value: 'company', label: 'Por empresa' },
    ];

  const permissionFilterOptions: Array<{
    value: PermissionAssignmentFilter;
    label: string;
  }> = [
    { value: 'all', label: 'Todos los roles' },
    { value: 'with', label: 'Con permisos' },
    { value: 'without', label: 'Sin permisos' },
  ];

  return (
    <div className="mx-auto w-full max-w-5xl">
      <TripledDataPanel
        title="Roles"
        description="Lista de todos los roles registrados."
        searchValue={searchValue}
        onSearchChange={setSearchValue}
        ctaSlot={canWriteRoles ? <CreateRoleDialog onCreated={fetchRoles} /> : null}
      >
        <div className="mb-4 flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            {companyScopeOptions.map((option) => (
              <Button
                key={option.value}
                type="button"
                variant={
                  companyScopeFilter === option.value ? 'default' : 'outline'
                }
                size="sm"
                onClick={() => setCompanyScopeFilter(option.value)}
                aria-label={`Filtrar por alcance: ${option.label.toLowerCase()}`}
              >
                {option.label}
              </Button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {permissionFilterOptions.map((option) => (
              <Button
                key={option.value}
                type="button"
                variant={
                  permissionAssignmentFilter === option.value
                    ? 'default'
                    : 'outline'
                }
                size="sm"
                onClick={() => setPermissionAssignmentFilter(option.value)}
                aria-label={`Filtrar por permisos: ${option.label.toLowerCase()}`}
              >
                {option.label}
              </Button>
            ))}
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            <p className="text-xs text-muted-foreground sm:text-sm">
              Mostrando{' '}
              <span className="font-medium text-foreground">
                {filteredRoles.length}
              </span>
              {roles.length !== filteredRoles.length ? (
                <>
                  {' '}
                  de{' '}
                  <span className="font-medium text-foreground">
                    {roles.length}
                  </span>
                </>
              ) : null}{' '}
              roles
            </p>
            <div className="w-full sm:w-auto md:hidden">
              <Select
                value={mobileSortValue}
                onValueChange={(value) => setSorting(decodeSortingState(value))}
              >
                <SelectTrigger
                  className="h-10 w-full sm:w-[min(100%,18rem)]"
                  aria-label="Ordenar lista de roles"
                >
                  <SelectValue placeholder="Ordenar por" />
                </SelectTrigger>
                <SelectContent>
                  {ROLES_MOBILE_SORT_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex h-32 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : loadError ? (
          <div className="space-y-4">
            <TripledEmptyState
              icon={<Shield className="h-4 w-4" />}
              title="Error de carga"
              description={loadError}
            />
            <div className="flex justify-center">
              <Button type="button" variant="outline" onClick={fetchRoles}>
                Reintentar
              </Button>
            </div>
          </div>
        ) : filteredRoles.length === 0 ? (
          <TripledEmptyState
            icon={<Shield className="h-4 w-4" />}
            title="Sin resultados"
            description={
              roles.length === 0
                ? 'No hay roles registrados.'
                : 'No hay roles que coincidan con la búsqueda o los filtros.'
            }
          />
        ) : (
          <>
            <div className="space-y-3 md:hidden">
              {table.getRowModel().rows.map((row) => {
                const roleRow = row.original;
                return (
                  <article
                    key={row.id}
                    className={`rounded-lg border bg-card p-4 shadow-sm transition-colors ${
                      canWriteRoles ? 'cursor-pointer hover:bg-accent/30' : ''
                    }`}
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
                        <div onClick={(event) => event.stopPropagation()}>
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
                          {roleRow.company?.name ?? 'N/A'}
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
                  </article>
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
      </TripledDataPanel>

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
