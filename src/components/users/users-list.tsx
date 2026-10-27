'use client';

import * as React from 'react';
import {
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
} from '@tanstack/react-table';
import { getUsers, resetUserTemporaryPassword } from '@/actions/users';
import { TemporaryPasswordDialog } from '@/components/users/temporary-password-dialog';
import {
  TripledEmptyState,
  TripledListLoadingState,
  TripledMobileRecordCard,
} from '@/components/tripled';
import { resolveResourceListState } from '@/lib/resource-list-state';
import { KeyRound, Pencil, Trash, Users as UsersIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DesktopSwitch } from '@/components/desktop-switch';
import {
  LIST_PAGE_SIZE,
  ListDesktopTitle,
  ListEmpty,
  ListError,
  ListFooter,
  ListLoading,
  ListNoResults,
  ListRowMenu,
  ListTable,
  ListTableCard,
  listFooterPagination,
  type ListRowMenuItem,
} from '@/components/list-page';
import { CreateUserDialog } from '@/app/(app)/users/create-user-dialog';
import { UpdateUserDialog } from '@/app/(app)/users/update-user-dialog';
import { DeleteUserDialog } from '@/app/(app)/users/delete-user-dialog';
import { AdminRecordMenu } from '@/components/roles/admin-record-menu';
import { classifyClientError, getErrorMessageByType } from '@/lib/network-awareness';
import {
  createUsersColumns,
  type UserWithRelations,
} from '@/components/users/users-columns';
import {
  UsersFilterBar,
  type CompanyAssignmentFilter,
  type VerificationFilter,
} from '@/components/users/users-filter-bar';
import { DEFAULT_USERS_SORTING } from '@/components/users/users-sort-presets';
import { FormattedDate } from '@/components/formatted-date';
import { Badge } from '@/components/ui/badge';
import { useOperatorTenantCompany } from '@/hooks/use-operator-tenant-company';
import { usePermissions } from '@/hooks/use-permissions';
import { PERMISSIONS } from '@/lib/permissions';

const USERS_DESCRIPTION =
  'Usuarios de todas las empresas. Cada empresa gestiona su equipo en Mi empresa › Equipo.';

export function UsersList() {
  const permissions = usePermissions();
  const { tenantCompanyId, tenantCompanyName, isTenantScoped } =
    useOperatorTenantCompany();
  // Tenant admins (non-system) with users.write manage their own company; system
  // operators manage any company. Both are covered by `can(users.write)` since
  // the permission map sets `isSystem` for operators.
  const canWriteUsers = permissions.can(PERMISSIONS.users.write);
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
  const [resetUser, setResetUser] = React.useState<UserWithRelations | null>(
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

  /** Editar, Dar contraseña temporal, then Eliminar last; the phone card keeps its old icon spacing. */
  const menuItems = React.useCallback(
    (userRow: UserWithRelations, iconClassName?: string): ListRowMenuItem[] => [
      {
        label: 'Editar',
        icon: <Pencil className={iconClassName} aria-hidden data-icon="inline-start" />,
        onSelect: () => setEditUser(userRow),
      },
      {
        label: 'Dar contraseña temporal',
        icon: <KeyRound className={iconClassName} aria-hidden data-icon="inline-start" />,
        onSelect: () => setResetUser(userRow),
      },
      {
        label: 'Eliminar',
        icon: <Trash className={iconClassName} aria-hidden data-icon="inline-start" />,
        onSelect: () => setDeleteUser(userRow),
        destructive: true,
      },
    ],
    [],
  );

  const columns = React.useMemo(
    () =>
      createUsersColumns({
        renderActions: (userRow) =>
          canWriteUsers ? (
            <ListRowMenu label={`Acciones de ${userRow.name}`} items={menuItems(userRow)} />
          ) : null,
      }),
    [menuItems, canWriteUsers],
  );

  const table = useReactTable({
    data: filteredUsers,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    initialState: { pagination: { pageIndex: 0, pageSize: LIST_PAGE_SIZE } },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });
  // Phones list every user, as before; only the desktop table pages at 25.
  const phoneRows = table.getPrePaginationRowModel().rows;

  const hasActiveFilters =
    debouncedSearch !== '' ||
    verificationFilter !== 'all' ||
    companyAssignmentFilter !== 'all';
  const sheetFilterCount =
    Number(verificationFilter !== 'all') +
    Number(companyAssignmentFilter !== 'all');
  const listState = resolveResourceListState({
    isLoading: loading,
    loadError,
    totalCount: users.length,
    visibleCount: filteredUsers.length,
    hasActiveFilters,
  });

  // A refetch after a write keeps the desktop table, dimmed (ZIG-I33 §8).
  const desktopListState = resolveResourceListState({
    isLoading: loading && users.length === 0,
    loadError,
    totalCount: users.length,
    visibleCount: filteredUsers.length,
    hasActiveFilters,
  });
  const paged = table.getPageCount() > 1;

  // Limpiar clears filters and search, never the sort (ZIG-I33 §2).
  const handleClearFilters = () => {
    setSearchValue('');
    setDebouncedSearch('');
    setVerificationFilter('all');
    setCompanyAssignmentFilter('all');
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
              verificationFilter === 'verified'
                ? 'Verificados'
                : 'Sin verificar',
          },
        ]
      : []),
    ...(companyAssignmentFilter !== 'all'
      ? [
          {
            key: 'company',
            label:
              companyAssignmentFilter === 'assigned'
                ? 'Con empresa'
                : 'Sin empresa',
          },
        ]
      : []),
  ];

  const createUserDialog = canWriteUsers ? (
    <CreateUserDialog
      onCreated={fetchUsers}
      defaultCompanyId={tenantCompanyId ?? undefined}
      defaultCompanyName={tenantCompanyName ?? undefined}
      lockCompany={isTenantScoped}
    />
  ) : null;

  const filterBar = (
    <UsersFilterBar
      searchValue={searchValue}
      onSearchChange={setSearchValue}
      verificationFilter={verificationFilter}
      onVerificationFilterChange={setVerificationFilter}
      companyAssignmentFilter={companyAssignmentFilter}
      onCompanyAssignmentFilterChange={setCompanyAssignmentFilter}
      sorting={sorting}
      onSortingChange={setSorting}
      sheetFilterCount={sheetFilterCount}
      hasActiveFilters={hasActiveFilters}
      onClearFilters={handleClearFilters}
      filterChips={filterChips}
    />
  );

  const phone = (
    <div className="space-y-4">
      <div className="flex justify-end">{createUserDialog}</div>

      {filterBar}

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
          action={createUserDialog}
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
        <div className="space-y-3">
          {phoneRows.map((row) => {
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
                        <Badge variant="secondary" className="text-caption">
                          Correo verificado
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="text-caption text-muted-foreground"
                        >
                          Sin verificar
                        </Badge>
                      )}
                    </div>
                  </div>
                  {canWriteUsers ? (
                    <div onPointerDown={(event) => event.stopPropagation()}>
                      <AdminRecordMenu items={menuItems(u, 'mr-2 h-4 w-4')} />
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
                      {u.company?.name ?? 'Sin empresa'}
                    </dd>
                  </div>
                  <div className="grid grid-cols-[88px_1fr] gap-2">
                    <dt className="text-muted-foreground">Rol</dt>
                    <dd className="truncate">{u.role?.name ?? 'Sin rol'}</dd>
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
      )}
    </div>
  );

  const desktop = (
    <>
      <ListDesktopTitle
        title="Usuarios"
        count={loading && users.length === 0 ? null : users.length}
        description={USERS_DESCRIPTION}
        actions={createUserDialog}
      />
      <div className="space-y-4">
        {filterBar}
        {desktopListState.kind === 'loading' ? (
          <ListLoading label="Cargando lista de usuarios" columns={8} />
        ) : desktopListState.kind === 'error' ? (
          <ListError description={desktopListState.message} onRetry={fetchUsers} />
        ) : desktopListState.kind === 'empty' ? (
          <ListEmpty
            icon={<UsersIcon className="h-4 w-4 text-muted-foreground" aria-hidden />}
            title="Sin usuarios"
            description={
              canWriteUsers
                ? 'Crea el primer usuario y asígnale empresa y rol para habilitar su acceso.'
                : 'No hay usuarios registrados.'
            }
            action={createUserDialog}
          />
        ) : desktopListState.kind === 'filtered-empty' ? (
          <ListNoResults
            description="No hay usuarios que coincidan con la búsqueda o los filtros."
            onClear={handleClearFilters}
          />
        ) : (
          <ListTableCard
            footer={
              <ListFooter
                total={paged ? filteredUsers.length : users.length}
                shown={filteredUsers.length}
                noun="usuarios"
                pagination={listFooterPagination(table, { pageSizes: false })}
              />
            }
          >
            <ListTable
              table={table}
              ariaLabel="Usuarios"
              busy={loading}
              onOpenRow={canWriteUsers ? (row) => setEditUser(row.original) : undefined}
              rowTestId="users-row"
            />
          </ListTableCard>
        )}
      </div>
    </>
  );

  return (
    <>
      <DesktopSwitch phone={phone} desktop={desktop} />

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
      <TemporaryPasswordDialog
        target={resetUser}
        onReset={() =>
          resetUser
            ? resetUserTemporaryPassword(resetUser.id)
            : Promise.resolve({ success: false })
        }
        onOpenChange={(open) => {
          if (!open) {
            setResetUser(null);
          }
        }}
      />
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
