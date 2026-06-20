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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Plus, Pencil, Trash2, Search, UserPlus, Users, X } from 'lucide-react';
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
  TripledFilterChips,
  TripledListLoadingState,
  TripledMobileRecordCard,
} from '@/components/tripled';
import { classifyClientError, getErrorMessageByType } from '@/lib/network-awareness';
import { createClientsColumns } from '@/components/clients/clients-columns';
import {
  CLIENTS_MOBILE_SORT_OPTIONS,
  DEFAULT_CLIENT_SORTING,
  decodeSortingState,
  encodeSortingState,
} from '@/components/clients/clients-sort-presets';
import { usePermissions } from '@/hooks/use-permissions';
import { canWriteClients } from '@/lib/clients-rbac';
import { needsSelectedCompanyContext } from '@/lib/system-company-context';
import { SystemCompanyContextEmptyState } from '@/components/system-company-context-empty-state';
import { formatClientAddressOneLine } from '@/lib/client-address';
import { resolveResourceListState } from '@/lib/resource-list-state';

type ContactFilter = 'all' | 'with' | 'without';

const hasMeaningfulText = (value: string | null | undefined): boolean =>
  Boolean(value && value.trim().length > 0);

export function ClientList() {
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

  React.useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSearch(searchValue.trim());
    }, 300);
    return () => window.clearTimeout(timeoutId);
  }, [searchValue]);

  const fetchClients = React.useCallback(async () => {
    if (missingCompany) {
      setClients([]);
      setLoadError(null);
      setLoadingClients(false);
      return;
    }

    setLoadingClients(true);
    setLoadError(null);
    const result = await getClientsList({
      companyId: selectedCompany?.id ?? null,
    });
    if (result.success && result.data) {
      setClients(result.data);
    } else {
      const errorType = classifyClientError(null, undefined, result.errorType);
      setLoadError(
        getErrorMessageByType(
          errorType,
          result.error || 'No se pudieron cargar los clientes',
        ),
      );
    }
    setLoadingClients(false);
  }, [missingCompany, selectedCompany?.id]);

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
          canWrite ? (
            <>
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Editar ${clientRow.name}`}
              onClick={(event) => {
                event.stopPropagation();
                router.push(`/clients/${clientRow.id}/edit`);
              }}
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Eliminar ${clientRow.name}`}
              onClick={(event) => {
                event.stopPropagation();
                openDeleteDialog(clientRow.id);
              }}
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
            </>
          ) : null,
      }),
    [router, openDeleteDialog, canWrite],
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

  const mobileSortValue = encodeSortingState(sorting);
  const isBusy = loading || loadingClients;
  const hasActiveFilters =
    debouncedSearch !== '' || emailFilter !== 'all' || phoneFilter !== 'all';

  const emailFilterOptions: Array<{ value: ContactFilter; label: string }> = [
    { value: 'all', label: 'Todas' },
    { value: 'with', label: 'Con correo' },
    { value: 'without', label: 'Sin correo' },
  ];

  const phoneFilterOptions: Array<{ value: ContactFilter; label: string }> = [
    { value: 'all', label: 'Todos' },
    { value: 'with', label: 'Con teléfono' },
    { value: 'without', label: 'Sin teléfono' },
  ];

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

  return (
    <>
      <div className="space-y-4">
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={searchValue}
            onChange={(event) => handleSearchChange(event.target.value)}
            placeholder="Buscar por nombre, teléfono, correo o documento..."
            className="h-12 rounded-xl bg-muted/30 pl-9 shadow-none sm:h-11 sm:max-w-md sm:bg-background"
            aria-label="Buscar clientes"
          />
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div className="flex flex-col gap-2">
            <p className="text-xs font-medium text-muted-foreground">Correo</p>
            <div className="flex flex-wrap gap-2">
              {emailFilterOptions.map((option) => (
                <Button
                  key={option.value}
                  type="button"
                  variant={emailFilter === option.value ? 'default' : 'outline'}
                  className="min-h-11 rounded-xl"
                  onClick={() => setEmailFilter(option.value)}
                  aria-label={`Filtrar clientes por correo: ${option.label}`}
                >
                  {option.label}
                </Button>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <p className="text-xs font-medium text-muted-foreground">Teléfono</p>
            <div className="flex flex-wrap gap-2">
              {phoneFilterOptions.map((option) => (
                <Button
                  key={option.value}
                  type="button"
                  variant={phoneFilter === option.value ? 'default' : 'outline'}
                  className="min-h-11 rounded-xl"
                  onClick={() => setPhoneFilter(option.value)}
                  aria-label={`Filtrar clientes por teléfono: ${option.label}`}
                >
                  {option.label}
                </Button>
              ))}
            </div>
          </div>
          <div className="w-full sm:w-auto md:hidden">
            <Select
              value={mobileSortValue}
              onValueChange={(value) => setSorting(decodeSortingState(value))}
            >
              <SelectTrigger
                className="h-11 w-full rounded-xl sm:w-[min(100%,18rem)]"
                aria-label="Ordenar lista de clientes"
              >
                <SelectValue placeholder="Ordenar por" />
              </SelectTrigger>
              <SelectContent>
                {CLIENTS_MOBILE_SORT_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <TripledFilterChips chips={filterChips} />
          {hasActiveFilters ? (
            <Button
              type="button"
              variant="ghost"
              className="min-h-11 justify-start text-destructive hover:bg-destructive/10 hover:text-destructive sm:min-h-9"
              onClick={handleClearFilters}
              aria-label="Limpiar filtros de clientes"
            >
              <X className="mr-2 h-4 w-4" aria-hidden />
              Limpiar filtros
            </Button>
          ) : null}
        </div>
      </div>

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
              <X className="mr-2 h-4 w-4" aria-hidden />
              Limpiar filtros
            </Button>
          }
        />
      ) : listState.kind === 'empty' ? (
        <TripledEmptyState
          icon={<UserPlus className="h-4 w-4" />}
          title="Sin clientes"
          description={
            canWrite
              ? 'Agrega el primer cliente para registrar sus datos de contacto y crear tickets con mayor rapidez.'
              : 'No hay clientes registrados para esta empresa todavía.'
          }
          action={
            canWrite ? (
              <Button
                type="button"
                onClick={() => router.push('/clients/new')}
              >
                <Plus className="mr-2 h-4 w-4" aria-hidden />
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
                  tabIndex={canWrite ? 0 : -1}
                  aria-label={
                    canWrite
                      ? `Editar cliente ${clientRow.name}`
                      : `Cliente ${clientRow.name}`
                  }
                  interactive={canWrite}
                  className={
                    canWrite
                      ? 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
                      : undefined
                  }
                  onClick={() => {
                    if (canWrite) {
                      router.push(`/clients/${clientRow.id}/edit`);
                    }
                  }}
                  onKeyDown={(event) => {
                    if (
                      canWrite &&
                      (event.key === 'Enter' || event.key === ' ')
                    ) {
                      event.preventDefault();
                      router.push(`/clients/${clientRow.id}/edit`);
                    }
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-sm font-semibold text-foreground">
                      {clientRow.name}
                    </h3>
                    {canWrite ? (
                      <div className="flex shrink-0 gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Editar ${clientRow.name}`}
                        onClick={(event) => {
                          event.stopPropagation();
                          router.push(`/clients/${clientRow.id}/edit`);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Eliminar ${clientRow.name}`}
                        onClick={(event) => {
                          event.stopPropagation();
                          openDeleteDialog(clientRow.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                      </div>
                    ) : null}
                  </div>

                  <dl className="mt-3 space-y-2 text-sm">
                    <div className="grid grid-cols-[88px_1fr] gap-2">
                      <dt className="text-muted-foreground">Teléfono</dt>
                      <dd className="truncate tabular-nums">
                        {clientRow.phone || '—'}
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
                          header.column.id === 'actions' ? 'text-right' : undefined
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
                    className={canWrite ? 'cursor-pointer' : undefined}
                    tabIndex={canWrite ? 0 : -1}
                    onClick={() => {
                      if (canWrite) {
                        router.push(`/clients/${row.original.id}/edit`);
                      }
                    }}
                    onKeyDown={(event) => {
                      if (
                        canWrite &&
                        (event.key === 'Enter' || event.key === ' ')
                      ) {
                        event.preventDefault();
                        router.push(`/clients/${row.original.id}/edit`);
                      }
                    }}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell
                        key={cell.id}
                        className={
                          cell.column.id === 'actions' ? 'text-right' : undefined
                        }
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t pt-4">
            <p className="text-xs text-muted-foreground">
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

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminará permanentemente el
              cliente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => clientToDelete && handleDelete(clientToDelete)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
