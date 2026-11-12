'use client';

import * as React from 'react';
import {
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
} from '@tanstack/react-table';
import { getPermissions } from '@/actions/permissions';
import {
  TripledEmptyState,
  TripledListLoadingState,
  TripledMobileRecordCard,
} from '@/components/tripled';
import { KeyRound, Pencil, Trash2 } from 'lucide-react';
import { resolveResourceListState } from '@/lib/resource-list-state';
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
import { CreatePermissionDialog } from '@/app/(app)/permissions/create-permission-dialog';
import { UpdatePermissionDialog } from '@/app/(app)/permissions/update-permission-dialog';
import { DeletePermissionDialog } from '@/app/(app)/permissions/delete-permission-dialog';
import {
  createPermissionsColumns,
  type Permission,
} from '@/components/permissions/permissions-columns';
import { AdminRecordMenu } from '@/components/roles/admin-record-menu';
import { classifyClientError, getErrorMessageByType } from '@/lib/network-awareness';
import { FormattedDate } from '@/components/formatted-date';
import {
  PermissionsFilterBar,
  type PermissionsCompanyScopeFilter,
} from '@/components/permissions/permissions-filter-bar';
import { DEFAULT_PERMISSION_SORTING } from '@/components/permissions/permissions-sort-presets';
import { usePermissions } from '@/hooks/use-permissions';
import { PERMISSIONS as RBAC_PERMISSIONS } from '@/lib/permissions';

const PERMISSIONS_DESCRIPTION =
  'Claves de permiso que revisa el código. Solo para operadores del sistema.';

export function PermissionsList() {
  const sessionPermissions = usePermissions();
  const canWritePermissions =
    sessionPermissions.isSystem &&
    sessionPermissions.can(RBAC_PERMISSIONS.permissions.write);
  const [permissions, setPermissions] = React.useState<Permission[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [searchValue, setSearchValue] = React.useState('');
  const [debouncedSearch, setDebouncedSearch] = React.useState('');
  const [companyScopeFilter, setCompanyScopeFilter] =
    React.useState<PermissionsCompanyScopeFilter>('all');
  const [sorting, setSorting] =
    React.useState<SortingState>(DEFAULT_PERMISSION_SORTING);
  const [editPermission, setEditPermission] =
    React.useState<Permission | null>(null);
  const [deletePermission, setDeletePermission] =
    React.useState<Permission | null>(null);

  React.useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSearch(searchValue.trim());
    }, 300);
    return () => window.clearTimeout(timeoutId);
  }, [searchValue]);

  const fetchPermissions = React.useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const result = await getPermissions();
      if (result.success && result.data) {
        setPermissions(result.data as Permission[]);
      } else {
        const errorType = classifyClientError(
          null,
          undefined,
          result.errorType,
        );
        setLoadError(
          getErrorMessageByType(
            errorType,
            result.error || 'No se pudieron cargar los permisos',
          ),
        );
      }
    } catch (error) {
      console.error(error);
      const errorType = classifyClientError(error);
      setLoadError(
        getErrorMessageByType(
          errorType,
          'No se pudieron cargar los permisos',
        ),
      );
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchPermissions();
  }, [fetchPermissions]);

  const filteredPermissions = React.useMemo(() => {
    const q = debouncedSearch.toLowerCase();
    return permissions.filter((row) => {
      const matchesSearch =
        !q ||
        row.name.toLowerCase().includes(q) ||
        (row.description ?? '').toLowerCase().includes(q) ||
        (row.company?.name ?? '').toLowerCase().includes(q);

      if (!matchesSearch) {
        return false;
      }

      if (companyScopeFilter === 'global' && row.company != null) {
        return false;
      }
      if (companyScopeFilter === 'company' && row.company == null) {
        return false;
      }

      return true;
    });
  }, [permissions, debouncedSearch, companyScopeFilter]);

  const openEdit = React.useCallback((row: Permission) => {
    setEditPermission(row);
  }, []);

  /** Editar, then Eliminar last; the phone card keeps its old icon spacing. */
  const menuItems = React.useCallback(
    (row: Permission, iconClassName?: string): ListRowMenuItem[] => [
      {
        label: 'Editar',
        icon: <Pencil className={iconClassName} aria-hidden data-icon="inline-start" />,
        onSelect: () => openEdit(row),
      },
      {
        label: 'Eliminar',
        icon: <Trash2 className={iconClassName} aria-hidden data-icon="inline-start" />,
        onSelect: () => setDeletePermission(row),
        destructive: true,
      },
    ],
    [openEdit],
  );

  const columns = React.useMemo(
    () =>
      createPermissionsColumns({
        renderActions: (row) =>
          canWritePermissions ? (
            <ListRowMenu label={`Acciones de ${row.name}`} items={menuItems(row)} />
          ) : null,
      }),
    [menuItems, canWritePermissions],
  );

  const table = useReactTable({
    data: filteredPermissions,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    initialState: { pagination: { pageIndex: 0, pageSize: LIST_PAGE_SIZE } },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getRowId: (row) => String(row.id),
  });
  // Phones list every permission, as before; only the desktop table pages at 25.
  const phoneRows = table.getPrePaginationRowModel().rows;

  const hasActiveFilters = debouncedSearch !== '' || companyScopeFilter !== 'all';
  const sheetFilterCount = companyScopeFilter !== 'all' ? 1 : 0;
  const listState = resolveResourceListState({
    isLoading: loading,
    loadError,
    totalCount: permissions.length,
    visibleCount: filteredPermissions.length,
    hasActiveFilters,
  });

  // A refetch after a write keeps the desktop table, dimmed (ZIG-I33 §8).
  const desktopListState = resolveResourceListState({
    isLoading: loading && permissions.length === 0,
    loadError,
    totalCount: permissions.length,
    visibleCount: filteredPermissions.length,
    hasActiveFilters,
  });
  const paged = table.getPageCount() > 1;

  // Limpiar clears filters and search, never the sort (ZIG-I33 §2).
  const handleClearFilters = () => {
    setSearchValue('');
    setDebouncedSearch('');
    setCompanyScopeFilter('all');
  };

  const filterChips = [
    {
      key: 'count',
      label: `${filteredPermissions.length} de ${permissions.length} permisos`,
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
  ];

  const createPermissionDialog = canWritePermissions ? (
    <CreatePermissionDialog onCreated={fetchPermissions} />
  ) : null;

  const filterBar = (
    <PermissionsFilterBar
      searchValue={searchValue}
      onSearchChange={setSearchValue}
      companyScopeFilter={companyScopeFilter}
      onCompanyScopeFilterChange={setCompanyScopeFilter}
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
      <div className="flex justify-end">{createPermissionDialog}</div>

      {filterBar}

      {listState.kind === 'loading' ? (
        <TripledListLoadingState
          label="Cargando lista de permisos"
          desktopColumns={4}
          desktopRows={5}
        />
      ) : listState.kind === 'error' ? (
        <TripledEmptyState
          icon={<KeyRound className="h-4 w-4" />}
          title="Error de carga"
          description={listState.message}
          role="alert"
          action={
            <Button type="button" variant="outline" onClick={fetchPermissions}>
              Reintentar
            </Button>
          }
        />
      ) : listState.kind === 'empty' ? (
        <TripledEmptyState
          icon={<KeyRound className="h-4 w-4" />}
          title="Sin permisos"
          description={
            canWritePermissions
              ? 'Crea el primer permiso para habilitar controles de acceso por rol.'
              : 'No hay permisos registrados.'
          }
          action={createPermissionDialog}
        />
      ) : listState.kind === 'filtered-empty' ? (
        <TripledEmptyState
          icon={<KeyRound className="h-4 w-4" />}
          title="Sin resultados"
          description="No hay permisos que coincidan con la búsqueda o los filtros."
          action={
            <Button type="button" variant="outline" onClick={handleClearFilters}>
              Limpiar filtros
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {phoneRows.map((row) => {
            const permRow = row.original;
            return (
              <TripledMobileRecordCard
                key={row.id}
                interactive={canWritePermissions}
                tabIndex={canWritePermissions ? 0 : -1}
                role="button"
                aria-label={
                  canWritePermissions
                    ? `Editar permiso ${permRow.name}`
                    : `Permiso ${permRow.name}`
                }
                onClick={() => {
                  if (canWritePermissions) {
                    openEdit(permRow);
                  }
                }}
                onKeyDown={(event) => {
                  if (
                    canWritePermissions &&
                    (event.key === 'Enter' || event.key === ' ')
                  ) {
                    event.preventDefault();
                    openEdit(permRow);
                  }
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <h3 className="text-sm font-semibold text-foreground">
                      {permRow.name}
                    </h3>
                    <p className="line-clamp-3 text-sm text-muted-foreground">
                      {permRow.description || '—'}
                    </p>
                  </div>
                  {canWritePermissions ? (
                    <div onPointerDown={(event) => event.stopPropagation()}>
                      <AdminRecordMenu items={menuItems(permRow, 'mr-2 h-4 w-4')} />
                    </div>
                  ) : null}
                </div>
                <dl className="mt-3 space-y-2 text-sm">
                  <div className="grid grid-cols-[88px_1fr] gap-2">
                    <dt className="text-muted-foreground">Empresa</dt>
                    <dd className="truncate">
                      {permRow.company?.name ?? 'Sin empresa'}
                    </dd>
                  </div>
                  <div className="grid grid-cols-[88px_1fr] gap-2">
                    <dt className="text-muted-foreground">Creado</dt>
                    <dd>
                      <FormattedDate date={permRow.created_at} />
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
        title="Permisos"
        count={loading && permissions.length === 0 ? null : permissions.length}
        description={PERMISSIONS_DESCRIPTION}
        actions={createPermissionDialog}
      />
      <div className="space-y-4">
        {filterBar}
        {desktopListState.kind === 'loading' ? (
          <ListLoading label="Cargando lista de permisos" columns={5} />
        ) : desktopListState.kind === 'error' ? (
          <ListError description={desktopListState.message} onRetry={fetchPermissions} />
        ) : desktopListState.kind === 'empty' ? (
          <ListEmpty
            icon={<KeyRound className="h-4 w-4 text-muted-foreground" aria-hidden />}
            title="Sin permisos"
            description={
              canWritePermissions
                ? 'Crea el primer permiso para habilitar controles de acceso por rol.'
                : 'No hay permisos registrados.'
            }
            action={createPermissionDialog}
          />
        ) : desktopListState.kind === 'filtered-empty' ? (
          <ListNoResults
            description="No hay permisos que coincidan con la búsqueda o los filtros."
            onClear={handleClearFilters}
          />
        ) : (
          <ListTableCard
            footer={
              <ListFooter
                total={paged ? filteredPermissions.length : permissions.length}
                shown={filteredPermissions.length}
                noun="permisos"
                pagination={listFooterPagination(table, { pageSizes: false })}
              />
            }
          >
            <ListTable
              table={table}
              ariaLabel="Permisos"
              busy={loading}
              onOpenRow={canWritePermissions ? (row) => openEdit(row.original) : undefined}
              rowTestId="permissions-row"
            />
          </ListTableCard>
        )}
      </div>
    </>
  );

  return (
    <>
      <DesktopSwitch phone={phone} desktop={desktop} />
      {editPermission ? (
        <UpdatePermissionDialog
          permission={editPermission}
          open
          onOpenChange={(open) => {
            if (!open) {
              setEditPermission(null);
            }
          }}
          onSuccess={fetchPermissions}
        />
      ) : null}
      {deletePermission ? (
        <DeletePermissionDialog
          permission={deletePermission}
          open
          onOpenChange={(open) => {
            if (!open) {
              setDeletePermission(null);
            }
          }}
          onSuccess={fetchPermissions}
        />
      ) : null}
    </>
  );
}
