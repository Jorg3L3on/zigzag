'use client';

import * as React from 'react';
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
} from '@tanstack/react-table';
import { getUsers } from '@/actions/users';
import {
  TripledEmptyState,
  TripledFilterChips,
  TripledListLoadingState,
  TripledMobileRecordCard,
} from '@/components/tripled';
import { resolveResourceListState } from '@/lib/resource-list-state';
import {
  Search,
  Users as UsersIcon,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CreateUserDialog } from '@/app/dashboard/users/create-user-dialog';
import { UpdateUserDialog } from '@/app/dashboard/users/update-user-dialog';
import { DeleteUserDialog } from '@/app/dashboard/users/delete-user-dialog';
import { UserActionsMenu } from '@/components/users/user-actions-menu';
import { classifyClientError, getErrorMessageByType } from '@/lib/network-awareness';
import {
  createUsersColumns,
  type UserWithRelations,
} from '@/components/users/users-columns';
import {
  DEFAULT_USERS_SORTING,
  USERS_MOBILE_SORT_OPTIONS,
  decodeSortingState,
  encodeSortingState,
} from '@/components/users/users-sort-presets';
import { FormattedDate } from '@/components/formatted-date';
import { Badge } from '@/components/ui/badge';
import { useOperatorTenantCompany } from '@/hooks/use-operator-tenant-company';
import { usePermissions } from '@/hooks/use-permissions';
import { PERMISSIONS } from '@/lib/permissions';

type VerificationFilter = 'all' | 'verified' | 'unverified';
type CompanyAssignmentFilter = 'all' | 'assigned' | 'unassigned';

export function UsersList() {
  const permissions = usePermissions();
  const { tenantCompanyId, tenantCompanyName, isTenantScoped } =
    useOperatorTenantCompany();
  const canWriteUsers =
    permissions.isSystem && permissions.can(PERMISSIONS.users.write);
  const [users, setUsers] = React.useState<UserWithRelations[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [searchValue, setSearchValue] = React.useState('');
  const [debouncedSearch, setDebouncedSearch] = React.useState('');
  const [verificationFilter, setVerificationFilter] =
    React.useState<VerificationFilter>('all');
  const [companyAssignmentFilter, setCompanyAssignmentFilter] =
    React.useState<CompanyAssignmentFilter>('all');
  const [sorting, setSorting] =
    React.useState<SortingState>(DEFAULT_USERS_SORTING);
  const [editUser, setEditUser] = React.useState<UserWithRelations | null>(
    null,
  );
  const [deleteUser, setDeleteUser] = React.useState<UserWithRelations | null>(
    null,
  );

  React.useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSearch(searchValue.trim());
    }, 300);
    return () => window.clearTimeout(timeoutId);
  }, [searchValue]);

  const fetchUsers = React.useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const result = await getUsers();
      if (result.success && result.data) {
        setUsers(result.data as UserWithRelations[]);
      } else {
        const errorType = classifyClientError(
          null,
          undefined,
          result.errorType,
        );
        setLoadError(
          getErrorMessageByType(
            errorType,
            result.error || 'No se pudieron cargar los usuarios',
          ),
        );
      }
    } catch (error) {
      console.error(error);
      const errorType = classifyClientError(error);
      setLoadError(
        getErrorMessageByType(
          errorType,
          'No se pudieron cargar los usuarios',
        ),
      );
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void fetchUsers();
  }, [fetchUsers]);

  const filteredUsers = React.useMemo(() => {
    const q = debouncedSearch.toLowerCase();
    return users.filter((row) => {
      const matchesSearch =
        !q ||
        row.name.toLowerCase().includes(q) ||
        row.email.toLowerCase().includes(q) ||
        (row.company?.name ?? '').toLowerCase().includes(q) ||
        (row.role?.name ?? '').toLowerCase().includes(q) ||
        row.id.toString().includes(q);

      if (!matchesSearch) {
        return false;
      }

      if (verificationFilter === 'verified' && !row.email_verified_at) {
        return false;
      }
      if (verificationFilter === 'unverified' && row.email_verified_at) {
        return false;
      }

      if (
        companyAssignmentFilter === 'assigned' &&
        row.company_id == null
      ) {
        return false;
      }
      if (
        companyAssignmentFilter === 'unassigned' &&
        row.company_id != null
      ) {
        return false;
      }

      if (tenantCompanyId != null && row.company_id !== tenantCompanyId) {
        return false;
      }

      return true;
    });
  }, [
    users,
    debouncedSearch,
    verificationFilter,
    companyAssignmentFilter,
    tenantCompanyId,
  ]);

  const columns = React.useMemo(
    () =>
      createUsersColumns({
        renderActions: (userRow) =>
          canWriteUsers ? (
          <div
            className="flex justify-end"
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => event.stopPropagation()}
          >
            <UserActionsMenu
              onEditRequest={() => setEditUser(userRow)}
              onDeleteRequest={() => setDeleteUser(userRow)}
            />
          </div>
          ) : null,
      }),
    [canWriteUsers],
  );

  const table = useReactTable({
    data: filteredUsers,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const mobileSortValue = encodeSortingState(sorting);
  const hasActiveFilters =
    debouncedSearch !== '' ||
    verificationFilter !== 'all' ||
    companyAssignmentFilter !== 'all';
  const listState = resolveResourceListState({
    isLoading: loading,
    loadError,
    totalCount: users.length,
    visibleCount: filteredUsers.length,
    hasActiveFilters,
  });

  const verificationOptions: Array<{
    value: VerificationFilter;
    label: string;
  }> = [
    { value: 'all', label: 'Todos' },
    { value: 'verified', label: 'Verificados' },
    { value: 'unverified', label: 'Sin verificar' },
  ];

  const companyOptions: Array<{
    value: CompanyAssignmentFilter;
    label: string;
  }> = [
    { value: 'all', label: 'Empresa: todas' },
    { value: 'assigned', label: 'Con empresa' },
    { value: 'unassigned', label: 'Sin empresa' },
  ];

  const handleClearFilters = () => {
    setSearchValue('');
    setDebouncedSearch('');
    setVerificationFilter('all');
    setCompanyAssignmentFilter('all');
    setSorting(DEFAULT_USERS_SORTING);
  };

  const filterChips = [
    {
      key: 'count',
      label: `${filteredUsers.length} de ${users.length} usuarios`,
      variant: 'secondary' as const,
    },
    ...(debouncedSearch
      ? [{ key: 'search', label: `Búsqueda: ${debouncedSearch}` }]
      : []),
    ...(verificationFilter !== 'all'
      ? [
          {
            key: 'verification',
            label:
              verificationOptions.find(
                (option) => option.value === verificationFilter,
              )?.label ?? 'Correo',
          },
        ]
      : []),
    ...(companyAssignmentFilter !== 'all'
      ? [
          {
            key: 'company',
            label:
              companyOptions.find(
                (option) => option.value === companyAssignmentFilter,
              )?.label ?? 'Empresa',
          },
        ]
      : []),
  ];

  return (
    <>
      <div className="space-y-4">
        <div className="flex justify-end">
            {canWriteUsers ? (
              <CreateUserDialog
                onCreated={fetchUsers}
                defaultCompanyId={tenantCompanyId ?? undefined}
                defaultCompanyName={tenantCompanyName ?? undefined}
                lockCompany={isTenantScoped}
              />
            ) : null}
        </div>
          <div className="space-y-4">
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                value={searchValue}
                onChange={(event) => setSearchValue(event.target.value)}
                placeholder="Buscar por nombre, correo, empresa, rol o ID..."
                className="h-12 rounded-xl bg-muted/30 pl-9 shadow-none sm:h-11 sm:max-w-md sm:bg-background"
                aria-label="Buscar usuarios"
              />
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
              <div className="flex flex-wrap gap-2">
                {verificationOptions.map((option) => (
                  <Button
                    key={option.value}
                    type="button"
                    variant={
                      verificationFilter === option.value
                        ? 'default'
                        : 'outline'
                    }
                    className="min-h-11 rounded-xl"
                    onClick={() => setVerificationFilter(option.value)}
                    aria-label={`Filtrar correo: ${option.label.toLowerCase()}`}
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                {companyOptions.map((option) => (
                  <Button
                    key={option.value}
                    type="button"
                    variant={
                      companyAssignmentFilter === option.value
                        ? 'default'
                        : 'outline'
                    }
                    className="min-h-11 rounded-xl"
                    onClick={() => setCompanyAssignmentFilter(option.value)}
                    aria-label={`Filtrar ${option.label.toLowerCase()}`}
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
              <div className="w-full sm:w-auto md:hidden">
                <Select
                  value={mobileSortValue}
                  onValueChange={(value) =>
                    setSorting(decodeSortingState(value))
                  }
                >
                  <SelectTrigger
                    className="h-11 w-full rounded-xl sm:w-[min(100%,18rem)]"
                    aria-label="Ordenar lista de usuarios"
                  >
                    <SelectValue placeholder="Ordenar por" />
                  </SelectTrigger>
                  <SelectContent>
                    {USERS_MOBILE_SORT_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {!loading && !loadError ? (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <TripledFilterChips chips={filterChips} />
                {hasActiveFilters ? (
                  <Button
                    type="button"
                    variant="ghost"
                    className="min-h-11 justify-start text-destructive hover:bg-destructive/10 hover:text-destructive sm:min-h-9"
                    onClick={handleClearFilters}
                    aria-label="Limpiar filtros de usuarios"
                  >
                    <X className="mr-2 h-4 w-4" aria-hidden />
                    Limpiar filtros
                  </Button>
                ) : null}
              </div>
            ) : null}
          </div>

          {listState.kind === 'loading' ? (
            <TripledListLoadingState
              label="Cargando lista de usuarios"
              desktopColumns={6}
              desktopRows={5}
            />
          ) : listState.kind === 'error' ? (
            <TripledEmptyState
              icon={<UsersIcon className="h-4 w-4" />}
              title="Error de carga"
              description={listState.message}
              role="alert"
              action={
                <Button type="button" variant="outline" onClick={fetchUsers}>
                  Reintentar
                </Button>
              }
            />
          ) : listState.kind === 'empty' ? (
            <TripledEmptyState
              icon={<UsersIcon className="h-4 w-4" />}
              title="Sin usuarios"
              description={
                canWriteUsers
                  ? 'Crea el primer usuario y asígnale empresa y rol para habilitar su acceso.'
                  : 'No hay usuarios registrados.'
              }
              action={
                canWriteUsers ? (
                  <CreateUserDialog
                    onCreated={fetchUsers}
                    defaultCompanyId={tenantCompanyId ?? undefined}
                    defaultCompanyName={tenantCompanyName ?? undefined}
                    lockCompany={isTenantScoped}
                  />
                ) : null
              }
            />
          ) : listState.kind === 'filtered-empty' ? (
            <TripledEmptyState
              icon={<UsersIcon className="h-4 w-4" />}
              title="Sin resultados"
              description="No hay usuarios que coincidan con la búsqueda o los filtros."
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
                  const u = row.original;
                  return (
                    <TripledMobileRecordCard
                      key={row.id}
                      interactive={canWriteUsers}
                      tabIndex={canWriteUsers ? 0 : -1}
                      role="button"
                      aria-label={
                        canWriteUsers ? `Editar usuario ${u.name}` : `Usuario ${u.name}`
                      }
                      onClick={() => {
                        if (canWriteUsers) {
                          setEditUser(u);
                        }
                      }}
                      onKeyDown={(event) => {
                        if (
                          canWriteUsers &&
                          (event.key === 'Enter' || event.key === ' ')
                        ) {
                          event.preventDefault();
                          setEditUser(u);
                        }
                      }}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 space-y-1">
                          <h3 className="text-sm font-semibold text-foreground">
                            {u.name}
                          </h3>
                          <p className="truncate text-sm text-muted-foreground">
                            {u.email}
                          </p>
                          <div className="flex flex-wrap gap-1.5 pt-1">
                            {u.email_verified_at ? (
                              <Badge variant="secondary" className="text-xs">
                                Correo verificado
                              </Badge>
                            ) : (
                              <Badge
                                variant="outline"
                                className="text-xs text-muted-foreground"
                              >
                                Sin verificar
                              </Badge>
                            )}
                          </div>
                        </div>
                        {canWriteUsers ? (
                          <div onClick={(event) => event.stopPropagation()}>
                          <UserActionsMenu
                            onEditRequest={() => setEditUser(u)}
                            onDeleteRequest={() => setDeleteUser(u)}
                          />
                          </div>
                        ) : null}
                      </div>
                      <dl className="mt-3 space-y-2 text-sm">
                        <div className="grid grid-cols-[88px_1fr] gap-2">
                          <dt className="text-muted-foreground">ID</dt>
                          <dd className="tabular-nums">{u.id.toString()}</dd>
                        </div>
                        <div className="grid grid-cols-[88px_1fr] gap-2">
                          <dt className="text-muted-foreground">Empresa</dt>
                          <dd className="truncate">
                            {u.company?.name ?? 'N/A'}
                          </dd>
                        </div>
                        <div className="grid grid-cols-[88px_1fr] gap-2">
                          <dt className="text-muted-foreground">Rol</dt>
                          <dd className="truncate">{u.role?.name ?? 'N/A'}</dd>
                        </div>
                        <div className="grid grid-cols-[88px_1fr] gap-2">
                          <dt className="text-muted-foreground">Alta</dt>
                          <dd>
                            <FormattedDate date={u.created_at} />
                          </dd>
                        </div>
                      </dl>
                    </TripledMobileRecordCard>
                  );
                })}
              </div>

              <div className="hidden overflow-hidden rounded-xl border border-border/70 shadow-sm md:block">
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
                        className={canWriteUsers ? 'cursor-pointer' : undefined}
                        tabIndex={canWriteUsers ? 0 : -1}
                        aria-label={
                          canWriteUsers
                            ? `Editar usuario ${row.original.name}`
                            : `Usuario ${row.original.name}`
                        }
                        onClick={() => {
                          if (canWriteUsers) {
                            setEditUser(row.original);
                          }
                        }}
                        onKeyDown={(event) => {
                          if (
                            canWriteUsers &&
                            (event.key === 'Enter' || event.key === ' ')
                          ) {
                            event.preventDefault();
                            setEditUser(row.original);
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
            </>
          )}
      </div>

      {editUser ? (
        <UpdateUserDialog
          user={editUser}
          open
          onOpenChange={(open) => {
            if (!open) {
              setEditUser(null);
            }
          }}
          onSuccess={fetchUsers}
        />
      ) : null}
      {deleteUser ? (
        <DeleteUserDialog
          user={deleteUser}
          open
          onOpenChange={(open) => {
            if (!open) {
              setDeleteUser(null);
            }
          }}
          onSuccess={fetchUsers}
        />
      ) : null}
    </>
  );
}
