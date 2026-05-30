'use client';

import * as React from 'react';
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
} from '@tanstack/react-table';
import { getPermissions } from '@/actions/permissions';
import {
  TripledEmptyState,
  TripledFilterChips,
  TripledMobileRecordCard,
} from '@/components/tripled';
import { KeyRound, Loader2, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { CreatePermissionDialog } from '@/app/dashboard/permissions/create-permission-dialog';
import { UpdatePermissionDialog } from '@/app/dashboard/permissions/update-permission-dialog';
import { DeletePermissionDialog } from '@/app/dashboard/permissions/delete-permission-dialog';
import {
  createPermissionsColumns,
  type Permission,
} from '@/components/permissions/permissions-columns';
import { PermissionActionsMenu } from '@/components/permissions/permission-actions-menu';
import { classifyClientError, getErrorMessageByType } from '@/lib/network-awareness';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { FormattedDate } from '@/components/formatted-date';
import { Input } from '@/components/ui/input';
import {
  DEFAULT_PERMISSION_SORTING,
  PERMISSIONS_MOBILE_SORT_OPTIONS,
  decodeSortingState,
  encodeSortingState,
} from '@/components/permissions/permissions-sort-presets';
import { usePermissions } from '@/hooks/use-permissions';
import { PERMISSIONS as RBAC_PERMISSIONS } from '@/lib/permissions';

type CompanyScopeFilter = 'all' | 'global' | 'company';

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
    React.useState<CompanyScopeFilter>('all');
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

  const columns = React.useMemo(
    () =>
      createPermissionsColumns({
        renderActions: (row) =>
          canWritePermissions ? (
          <PermissionActionsMenu
            onEditRequest={() => openEdit(row)}
            onDeleteRequest={() => setDeletePermission(row)}
          />
          ) : null,
      }),
    [openEdit, canWritePermissions],
  );

  const table = useReactTable({
    data: filteredPermissions,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getRowId: (row) => String(row.id),
  });

  const mobileSortValue = encodeSortingState(sorting);
  const hasActiveFilters = debouncedSearch !== '' || companyScopeFilter !== 'all';

  const companyScopeOptions: Array<{ value: CompanyScopeFilter; label: string }> =
    [
      { value: 'all', label: 'Todos' },
      { value: 'global', label: 'Sin empresa' },
      { value: 'company', label: 'Por empresa' },
    ];

  const handleClearFilters = () => {
    setSearchValue('');
    setDebouncedSearch('');
    setCompanyScopeFilter('all');
    setSorting(DEFAULT_PERMISSION_SORTING);
  };

  const filterChips = [
    {
      key: 'count',
      label: `${filteredPermissions.length} de ${permissions.length} permisos`,
      variant: 'secondary' as const,
    },
    ...(debouncedSearch
      ? [{ key: 'search', label: `Busqueda: ${debouncedSearch}` }]
      : []),
    ...(companyScopeFilter !== 'all'
      ? [
          {
            key: 'scope',
            label:
              companyScopeOptions.find(
                (option) => option.value === companyScopeFilter,
              )?.label ?? 'Alcance',
          },
        ]
      : []),
  ];

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        {canWritePermissions ? (
          <CreatePermissionDialog onCreated={fetchPermissions} />
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
            placeholder="Buscar por permiso, descripcion o empresa..."
            className="h-12 rounded-xl bg-muted/30 pl-9 shadow-none sm:h-11 sm:max-w-md sm:bg-background"
            aria-label="Buscar permisos"
          />
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            {companyScopeOptions.map((option) => (
              <Button
                key={option.value}
                type="button"
                variant={
                  companyScopeFilter === option.value ? 'default' : 'outline'
                }
                className="min-h-11 rounded-xl"
                onClick={() => setCompanyScopeFilter(option.value)}
                aria-label={`Filtrar por alcance: ${option.label.toLowerCase()}`}
              >
                {option.label}
              </Button>
            ))}
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            <TripledFilterChips chips={filterChips} />
            {hasActiveFilters ? (
              <Button
                type="button"
                variant="ghost"
                className="min-h-11 justify-start text-destructive hover:bg-destructive/10 hover:text-destructive sm:min-h-9"
                onClick={handleClearFilters}
                aria-label="Limpiar filtros de permisos"
              >
                <X className="mr-2 h-4 w-4" aria-hidden />
                Limpiar filtros
              </Button>
            ) : null}
            <div className="w-full sm:w-auto md:hidden">
              <Select
                value={mobileSortValue}
                onValueChange={(value) => setSorting(decodeSortingState(value))}
              >
                <SelectTrigger
                  className="h-11 w-full rounded-xl sm:w-[min(100%,18rem)]"
                  aria-label="Ordenar lista de permisos"
                >
                  <SelectValue placeholder="Ordenar por" />
                </SelectTrigger>
                <SelectContent>
                  {PERMISSIONS_MOBILE_SORT_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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
              icon={<KeyRound className="h-4 w-4" />}
              title="Error de carga"
              description={loadError}
            />
            <div className="flex justify-center">
              <Button
                type="button"
                variant="outline"
                onClick={fetchPermissions}
              >
                Reintentar
              </Button>
            </div>
          </div>
        ) : filteredPermissions.length === 0 ? (
          <TripledEmptyState
            icon={<KeyRound className="h-4 w-4" />}
            title="Sin resultados"
            description={
              permissions.length === 0
                ? 'No hay permisos registrados.'
                : 'No hay permisos que coincidan con la búsqueda o los filtros.'
            }
          />
        ) : (
          <>
            <div className="space-y-3 md:hidden">
              {table.getRowModel().rows.map((row) => {
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
                        <div onClick={(event) => event.stopPropagation()}>
                        <PermissionActionsMenu
                          onEditRequest={() => openEdit(permRow)}
                          onDeleteRequest={() => setDeletePermission(permRow)}
                        />
                        </div>
                      ) : null}
                    </div>
                    <dl className="mt-3 space-y-2 text-sm">
                      <div className="grid grid-cols-[88px_1fr] gap-2">
                        <dt className="text-muted-foreground">Empresa</dt>
                        <dd className="truncate">
                          {permRow.company?.name ?? 'N/A'}
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
                        className={
                          canWritePermissions ? 'cursor-pointer' : undefined
                        }
                        tabIndex={canWritePermissions ? 0 : -1}
                        aria-label={
                          canWritePermissions
                            ? `Editar permiso ${row.original.name}`
                            : `Permiso ${row.original.name}`
                        }
                        onClick={() => {
                          if (canWritePermissions) {
                            openEdit(row.original);
                          }
                        }}
                        onKeyDown={(event) => {
                          if (
                            canWritePermissions &&
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
    </div>
  );
}
