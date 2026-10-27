'use client';

import React from 'react';
import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type PaginationState,
  type SortingState,
} from '@tanstack/react-table';
import { Button } from '@/components/ui/button';
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { MoreVertical, PenLine, Plus, Pencil, Trash2, UserPlus, Users, X } from 'lucide-react';
import Link from 'next/link';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { PERMISSIONS } from '@/lib/permissions';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Client,
  deleteClient,
  getClientsList,
} from '@/actions/clients';
import { useCompany } from '@/contexts/company-context';
import {
  TripledEmptyState,
  TripledListLoadingState,
  TripledMobileRecordCard,
} from '@/components/tripled';
import { MobilePullToRefresh } from '@/components/mobile-pull-to-refresh';
import { classifyClientError, getErrorMessageByType } from '@/lib/network-awareness';
import {
  formatOfflineSnapshotBanner,
  readOfflineSnapshot,
  writeOfflineSnapshot,
} from '@/lib/offline-snapshot';
import { createClientsColumns } from '@/components/clients/clients-columns';
import {
  ClientsFilterBar,
  type ContactFilter,
} from '@/components/clients/clients-filter-bar';
import { DEFAULT_CLIENT_SORTING } from '@/components/clients/clients-sort-presets';
import { usePermissions } from '@/hooks/use-permissions';
import { canWriteClients } from '@/lib/clients-rbac';
import { needsSelectedCompanyContext } from '@/lib/system-company-context';
import { SystemCompanyContextEmptyState } from '@/components/system-company-context-empty-state';
import { formatClientAddressOneLine } from '@/lib/client-address';
import { resolveResourceListState } from '@/lib/resource-list-state';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import {
  COBRANZA_TABLE_CARD_CLASS,
  COBRANZA_TABLE_CLASS,
} from '@/components/cobranza/cobranza-ticket-table';
import { ListDesktopTitle, ListRowMenu } from '@/components/list-filter';

type FetchClientsOutcome = { ok: true } | { ok: false; message: string };

const hasMeaningfulText = (value: string | null | undefined): boolean =>
  Boolean(value && value.trim().length > 0);

type ClientListProps = {
  /** Importar CSV and Nuevo cliente, beside the desktop title (ZIG-30). */
  desktopActions?: React.ReactNode;
};

export function ClientList({ desktopActions }: ClientListProps = {}) {
  const { selectedCompany } = useCompany();
  const permissions = usePermissions();
  const canWrite = canWriteClients(permissions.can);
  const missingCompany = needsSelectedCompanyContext(
    permissions.isSystem,
    selectedCompany?.id,
  );
  const router = useRouter();
  const [clients, setClients] = React.useState<Client[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [loadingClients, setLoadingClients] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [snapshotUpdatedAt, setSnapshotUpdatedAt] = React.useState<string | null>(
    null,
  );
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [clientToDelete, setClientToDelete] = React.useState<number | null>(null);
  const [searchValue, setSearchValue] = React.useState('');
  const [debouncedSearch, setDebouncedSearch] = React.useState('');
  const [emailFilter, setEmailFilter] = React.useState<ContactFilter>('all');
  const [phoneFilter, setPhoneFilter] = React.useState<ContactFilter>('all');
  const [sorting, setSorting] =
    React.useState<SortingState>(DEFAULT_CLIENT_SORTING);
  const [pagination, setPagination] = React.useState<PaginationState>({
    pageIndex: 0,
    pageSize: 12,
  });
  const clientsRef = React.useRef<Client[]>([]);

  React.useEffect(() => {
    clientsRef.current = clients;
  }, [clients]);

  React.useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSearch(searchValue.trim());
    }, 300);
    return () => window.clearTimeout(timeoutId);
  }, [searchValue]);

  const fetchClients = React.useCallback(
    async ({
      showLoading = true,
    }: { showLoading?: boolean } = {}): Promise<FetchClientsOutcome> => {
      if (missingCompany) {
        setClients([]);
        setLoadError(null);
        setSnapshotUpdatedAt(null);
        setLoadingClients(false);
        return { ok: true };
      }

      const companyId = selectedCompany?.id ?? null;
      const showOfflineSnapshot = async (): Promise<boolean> => {
        try {
          const snapshot = await readOfflineSnapshot<Client[]>('clients', companyId);
          if (!snapshot) return false;

          setClients(snapshot.data);
          clientsRef.current = snapshot.data;
          setSnapshotUpdatedAt(snapshot.updatedAt);
          setLoadError(null);
          return true;
        } catch (snapshotError) {
          console.warn('Unable to read clients offline snapshot:', snapshotError);
          return false;
        }
      };

      if (showLoading) {
        setLoadingClients(true);
        setLoadError(null);
      }

      try {
        const result = await getClientsList({
          companyId,
        });
        if (result.success && result.data) {
          setClients(result.data);
          clientsRef.current = result.data;
          setSnapshotUpdatedAt(null);
          setLoadError(null);
          void writeOfflineSnapshot('clients', companyId, result.data).catch(
            (snapshotError) => {
              console.warn('Unable to write clients offline snapshot:', snapshotError);
            },
          );
          return { ok: true };
        }

        const errorType = classifyClientError(null, undefined, result.errorType);
        if (errorType === 'network' && (await showOfflineSnapshot())) {
          return { ok: true };
        }

        const message = getErrorMessageByType(
          errorType,
          result.error || 'No se pudieron cargar los clientes',
        );
        setSnapshotUpdatedAt(null);
        setLoadError(!showLoading && clientsRef.current.length > 0 ? null : message);
        return { ok: false, message };
      } catch (error) {
        console.error('Error fetching clients:', error);
        const errorType = classifyClientError(error);
        if (errorType === 'network' && (await showOfflineSnapshot())) {
          return { ok: true };
        }

        const message = getErrorMessageByType(
          errorType,
          'No se pudieron cargar los clientes',
        );
        setSnapshotUpdatedAt(null);
        setLoadError(!showLoading && clientsRef.current.length > 0 ? null : message);
        return { ok: false, message };
      } finally {
        if (showLoading) {
          setLoadingClients(false);
        }
      }
    },
    [missingCompany, selectedCompany?.id],
  );

  React.useEffect(() => {
    void fetchClients();
  }, [fetchClients]);

  const filteredClients = React.useMemo(() => {
    const q = debouncedSearch.toLowerCase();
    return clients.filter((clientRow) => {
      const formattedAddress = formatClientAddressOneLine(clientRow);
      const matchesSearch =
        !q ||
        clientRow.id.toString().includes(q) ||
        clientRow.name.toLowerCase().includes(q) ||
        (clientRow.email ?? '').toLowerCase().includes(q) ||
        (clientRow.phone ?? '').toLowerCase().includes(q) ||
        (clientRow.document ?? '').toLowerCase().includes(q) ||
        formattedAddress.toLowerCase().includes(q);

      if (!matchesSearch) {
        return false;
      }

      if (emailFilter === 'with' && !hasMeaningfulText(clientRow.email)) {
        return false;
      }
      if (emailFilter === 'without' && hasMeaningfulText(clientRow.email)) {
        return false;
      }

      if (phoneFilter === 'with' && !hasMeaningfulText(clientRow.phone)) {
        return false;
      }
      if (phoneFilter === 'without' && hasMeaningfulText(clientRow.phone)) {
        return false;
      }

      return true;
    });
  }, [clients, debouncedSearch, emailFilter, phoneFilter]);

  React.useEffect(() => {
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
  }, [debouncedSearch, emailFilter, phoneFilter]);

  const openDeleteDialog = React.useCallback((id: number) => {
    setClientToDelete(id);
    setDeleteDialogOpen(true);
  }, []);

  const columns = React.useMemo(
    () =>
      createClientsColumns({
        renderActions: (clientRow) =>
          canWrite && snapshotUpdatedAt == null ? (
            <ListRowMenu
              label={`Acciones de ${clientRow.name}`}
              items={[
                {
                  label: 'Editar cliente',
                  icon: <Pencil className="size-4" aria-hidden />,
                  onSelect: () => router.push(`/clients/${clientRow.id}/edit`),
                },
                {
                  label: 'Eliminar cliente',
                  icon: <Trash2 className="size-4" aria-hidden />,
                  onSelect: () => openDeleteDialog(clientRow.id),
                  destructive: true,
                },
              ]}
            />
          ) : null,
      }),
    [router, openDeleteDialog, canWrite, snapshotUpdatedAt],
  );

  const table = useReactTable({
    data: filteredClients,
    columns,
    state: { sorting, pagination },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  const isBusy = loading || loadingClients;
  const hasActiveFilters =
    debouncedSearch !== '' || emailFilter !== 'all' || phoneFilter !== 'all';
  const sheetFilterCount = [
    emailFilter !== 'all',
    phoneFilter !== 'all',
  ].filter(Boolean).length;
  const effectiveCanWrite = canWrite && snapshotUpdatedAt == null;
  // The detail page needs the network; the offline snapshot is read-only.
  const canOpenDetail = snapshotUpdatedAt == null;
  const canAnotar = permissions.can(PERMISSIONS.tickets.write) && snapshotUpdatedAt == null;
  const clientToDeleteName = clients.find((item) => item.id === clientToDelete)?.name ?? null;

  const handleDelete = async (id: number) => {
    try {
      setLoading(true);
      const result = await deleteClient(id, selectedCompany?.id ?? null);
      if (result.success) {
        toast.success('Cliente eliminado correctamente');
        await fetchClients();
      } else {
        const errorType = classifyClientError(null, undefined, result.errorType);
        toast.error(
          getErrorMessageByType(
            errorType,
            result.error || 'Error al eliminar el cliente',
          ),
        );
      }
    } catch (error) {
      console.error(error);
      const errorType = classifyClientError(error);
      toast.error(getErrorMessageByType(errorType, 'Error al eliminar el cliente'));
    } finally {
      setLoading(false);
      setDeleteDialogOpen(false);
      setClientToDelete(null);
    }
  };

  const handleSearchChange = (value: string) => {
    setSearchValue(value);
  };

  const handleClearFilters = () => {
    setSearchValue('');
    setDebouncedSearch('');
    setEmailFilter('all');
    setPhoneFilter('all');
    setSorting(DEFAULT_CLIENT_SORTING);
  };

  const handlePullToRefresh = React.useCallback(async () => {
    const result = await fetchClients({ showLoading: false });
    if (!result.ok) {
      toast.error(result.message);
    }
  }, [fetchClients]);

  const filterChips = [
    {
      key: 'count',
      label: `${filteredClients.length} de ${clients.length} clientes`,
      variant: 'secondary' as const,
    },
    ...(debouncedSearch
      ? [
          {
            key: 'search',
            label: `Búsqueda: ${debouncedSearch}`,
          },
        ]
      : []),
    ...(emailFilter !== 'all'
      ? [
          {
            key: 'email',
            label: emailFilter === 'with' ? 'Con correo' : 'Sin correo',
          },
        ]
      : []),
    ...(phoneFilter !== 'all'
      ? [
          {
            key: 'phone',
            label: phoneFilter === 'with' ? 'Con teléfono' : 'Sin teléfono',
          },
        ]
      : []),
  ];

  if (missingCompany) {
    return <SystemCompanyContextEmptyState resourceLabel="clientes" />;
  }

  const listState = resolveResourceListState({
    isLoading: isBusy,
    loadError,
    totalCount: clients.length,
    visibleCount: filteredClients.length,
    hasActiveFilters,
  });

  const { pageIndex, pageSize } = table.getState().pagination;
  const firstShown = filteredClients.length === 0 ? 0 : pageIndex * pageSize + 1;
  const lastShown = Math.min((pageIndex + 1) * pageSize, filteredClients.length);

  return (
    <>
      <ListDesktopTitle
        title="Clientes"
        count={loadingClients && clients.length === 0 ? null : clients.length}
        description="Catálogo de clientes y datos de contacto."
        actions={desktopActions}
      />
      <div className="space-y-4">
        <ClientsFilterBar
          searchValue={searchValue}
          onSearchChange={handleSearchChange}
          emailFilter={emailFilter}
          onEmailFilterChange={setEmailFilter}
          phoneFilter={phoneFilter}
          onPhoneFilterChange={setPhoneFilter}
          sorting={sorting}
          onSortingChange={setSorting}
          sheetFilterCount={sheetFilterCount}
          hasActiveFilters={hasActiveFilters}
          onClearFilters={handleClearFilters}
          filterChips={filterChips}
        />

        {snapshotUpdatedAt ? (
          <Alert
            role="status"
            className="border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-100"
          >
            <AlertDescription>
              {formatOfflineSnapshotBanner(snapshotUpdatedAt)}
            </AlertDescription>
          </Alert>
        ) : null}
      </div>

      <MobilePullToRefresh
        label="Desliza para actualizar clientes"
        onRefresh={handlePullToRefresh}
        disabled={isBusy}
        testId="clients-pull-to-refresh"
      >
        {listState.kind === 'loading' ? (
          <TripledListLoadingState
            label="Cargando lista de clientes"
            desktopColumns={5}
            desktopRows={6}
            mobileCards={4}
          />
        ) : listState.kind === 'error' ? (
            <TripledEmptyState
              icon={<Users className="h-4 w-4" />}
              title="Error de carga"
              description={listState.message}
              role="alert"
              action={
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    void fetchClients();
                  }}
                >
                  Reintentar
                </Button>
              }
            />
        ) : listState.kind === 'filtered-empty' ? (
          <TripledEmptyState
            icon={<Users className="h-4 w-4" />}
            title="Sin resultados"
            description="No hay clientes que coincidan con la búsqueda o los filtros seleccionados."
            action={
              <Button
                type="button"
                variant="outline"
                onClick={handleClearFilters}
                aria-label="Limpiar filtros de clientes"
              >
                <X className="mr-2 h-4 w-4" aria-hidden data-icon="inline-start" />
                Limpiar filtros
              </Button>
            }
          />
        ) : listState.kind === 'empty' ? (
          <TripledEmptyState
            icon={<UserPlus className="h-4 w-4" />}
            title="Sin clientes"
            description={
              effectiveCanWrite
                ? 'Agrega el primer cliente para registrar sus datos de contacto y crear tickets con mayor rapidez.'
                : 'No hay clientes registrados para esta empresa todavía.'
            }
            action={
              effectiveCanWrite ? (
                <Button
                  type="button"
                  onClick={() => router.push('/clients/new')}
                >
                  <Plus className="mr-2 h-4 w-4" aria-hidden data-icon="inline-start" />
                  Nuevo cliente
                </Button>
              ) : null
            }
          />
        ) : (
          <>
          <div className="space-y-3 md:hidden">
            {table.getRowModel().rows.map((row) => {
              const clientRow = row.original;
              const formattedAddress = formatClientAddressOneLine(clientRow);
              return (
                <TripledMobileRecordCard
                  key={row.id}
                  role="button"
                  tabIndex={canOpenDetail ? 0 : -1}
                  aria-label={
                    canOpenDetail
                      ? `Abrir cliente ${clientRow.name}`
                      : `Cliente ${clientRow.name}`
                  }
                  interactive={canOpenDetail}
                  className={
                    canOpenDetail
                      ? 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
                      : undefined
                  }
                  onClick={() => {
                    if (canOpenDetail) {
                      router.push(`/clients/${clientRow.id}`);
                    }
                  }}
                  onKeyDown={(event) => {
                    if (
                      canOpenDetail &&
                      (event.key === 'Enter' || event.key === ' ')
                    ) {
                      event.preventDefault();
                      router.push(`/clients/${clientRow.id}`);
                    }
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-base font-semibold text-foreground">
                      {clientRow.name}
                    </h3>
                    {effectiveCanWrite ? (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="-mr-2 -mt-2 size-11 shrink-0"
                            aria-label={`Más acciones de ${clientRow.name}`}
                            onClick={(event) => event.stopPropagation()}
                            onKeyDown={(event) => event.stopPropagation()}
                          >
                            <MoreVertical className="h-5 w-5" aria-hidden data-icon="inline-start" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" onClick={(event) => event.stopPropagation()}>
                          <DropdownMenuItem
                            className="min-h-11"
                            onSelect={() => router.push(`/clients/${clientRow.id}/edit`)}
                          >
                            <Pencil className="mr-2 h-4 w-4" aria-hidden data-icon="inline-start" />
                            Editar cliente
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="min-h-11 text-destructive focus:text-destructive"
                            onSelect={() => openDeleteDialog(clientRow.id)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" aria-hidden data-icon="inline-start" />
                            Eliminar cliente
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    ) : null}
                  </div>

                  <dl className="mt-3 space-y-2 text-sm">
                    <div className="grid grid-cols-[88px_1fr] gap-2">
                      <dt className="text-muted-foreground">Teléfono</dt>
                      <dd className="truncate">
                        <span className="tabular-nums">{clientRow.phone?.trim() || '—'}</span>
                      </dd>
                    </div>
                    <div className="grid grid-cols-[88px_1fr] gap-2">
                      <dt className="text-muted-foreground">Correo</dt>
                      <dd className="truncate">{clientRow.email || '—'}</dd>
                    </div>
                    <div className="grid grid-cols-[88px_1fr] gap-2">
                      <dt className="text-muted-foreground">Dirección</dt>
                      <dd className="line-clamp-2">{formattedAddress || '—'}</dd>
                    </div>
                  </dl>

                  {canAnotar ? (
                    <div
                      className="mt-3 flex gap-2"
                      onClick={(event) => event.stopPropagation()}
                      onKeyDown={(event) => event.stopPropagation()}
                    >
                      <Button asChild className="min-h-11 flex-1 text-base">
                        <Link href={`/anotar?clientId=${clientRow.id}`}>
                          <PenLine className="mr-2 h-4 w-4" aria-hidden data-icon="inline-start" />
                          Anotar trabajo
                        </Link>
                      </Button>
                    </div>
                  ) : null}
                </TripledMobileRecordCard>
              );
            })}
          </div>

          {/* From md the Cobranza table, its footer inside the card (ZIG-30). */}
          <div className={cn(COBRANZA_TABLE_CARD_CLASS, 'mt-4 hidden md:block')}>
            <table className={COBRANZA_TABLE_CLASS} aria-label="Clientes">
              <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <TableHead
                        key={header.id}
                        className={cn(
                          header.column.id === 'actions' && 'text-right',
                          header.column.columnDef.meta?.className,
                        )}
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
                    className={cn('h-14', canOpenDetail && 'cursor-pointer')}
                    tabIndex={canOpenDetail ? 0 : -1}
                    onClick={() => {
                      if (canOpenDetail) {
                        router.push(`/clients/${row.original.id}`);
                      }
                    }}
                    onKeyDown={(event) => {
                      if (
                        canOpenDetail &&
                        (event.key === 'Enter' || event.key === ' ')
                      ) {
                        event.preventDefault();
                        router.push(`/clients/${row.original.id}`);
                      }
                    }}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell
                        key={cell.id}
                        className={cn(
                          cell.column.id === 'actions' && 'text-right',
                          cell.column.columnDef.meta?.className,
                        )}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </table>
            <div className="flex items-center justify-between gap-3 border-t border-border/70 px-4 py-3">
              <p className="text-[13px] tabular-nums text-muted-foreground">
                {firstShown}–{lastShown} de {filteredClients.length} clientes
              </p>
              {table.getPageCount() > 1 ? (
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => table.previousPage()}
                    disabled={!table.getCanPreviousPage() || isBusy}
                  >
                    Anterior
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => table.nextPage()}
                    disabled={!table.getCanNextPage() || isBusy}
                  >
                    Siguiente
                  </Button>
                </div>
              ) : null}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t pt-4 md:hidden">
            <p className="text-caption text-muted-foreground">
              Página {table.getState().pagination.pageIndex + 1} de{' '}
              {table.getPageCount()}
            </p>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage() || isBusy}
              >
                Anterior
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage() || isBusy}
              >
                Siguiente
              </Button>
            </div>
          </div>
          </>
        )}
      </MobilePullToRefresh>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {clientToDeleteName ? `¿Borrar a ${clientToDeleteName}?` : '¿Borrar este cliente?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              No se puede deshacer. Sus tickets se quedan, pero ya no podrás elegirlo como cliente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => clientToDelete && handleDelete(clientToDelete)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Borrar cliente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
