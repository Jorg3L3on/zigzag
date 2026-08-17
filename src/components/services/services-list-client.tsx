'use client';

import React, { useMemo, useState } from 'react';
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
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
import { Plus, Pencil, Trash2, X } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
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
  deleteService,
  getServices,
  type ServiceStatusFilter,
} from '@/actions/services';
import type { Service } from '@/db/schema';
import { useCompany } from '@/contexts/company-context';
import {
  TripledEmptyState,
  TripledListLoadingState,
  TripledMobileRecordCard,
} from '@/components/tripled';
import { resolveResourceListState } from '@/lib/resource-list-state';
import { classifyClientError, getErrorMessageByType } from '@/lib/network-awareness';
import { createServicesColumns } from '@/components/services/services-columns';
import { ServicesFilterBar } from '@/components/services/services-filter-bar';
import { DEFAULT_SERVICE_SORTING } from '@/components/services/services-sort-presets';
import { FormattedCurrency } from '@/components/formatted-currency';
import { usePermissions } from '@/hooks/use-permissions';
import { canWriteServices } from '@/lib/services-rbac';
import { needsSelectedCompanyContext } from '@/lib/system-company-context';
import { SystemCompanyContextEmptyState } from '@/components/system-company-context-empty-state';

export function ServicesListClient() {
  const { selectedCompany } = useCompany();
  const permissions = usePermissions();
  const canWrite = canWriteServices(permissions.can);
  const missingCompany = needsSelectedCompanyContext(
    permissions.isSystem,
    selectedCompany?.id,
  );
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingServices, setLoadingServices] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [serviceToDelete, setServiceToDelete] = useState<number | null>(null);
  const [searchValue, setSearchValue] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ServiceStatusFilter>('active');
  const [sorting, setSorting] = useState<SortingState>(DEFAULT_SERVICE_SORTING);
  const router = useRouter();
  const searchParams = useSearchParams();
  const importedFlag = searchParams.get('imported');

  React.useEffect(() => {
    const timeoutId = window.setTimeout(
      () => setDebouncedSearch(searchValue.trim()),
      250,
    );
    return () => window.clearTimeout(timeoutId);
  }, [searchValue]);

  const handleDelete = async (id: number) => {
    try {
      setLoading(true);
      const result = await deleteService(id, selectedCompany?.id ?? null);
      if (result.success) {
        toast.success('Servicio movido a eliminados');
        const refreshed = await getServices(selectedCompany?.id ?? null, statusFilter);
        if (refreshed.success) {
          setServices(refreshed.data ?? []);
        }
      } else {
        const errorType = classifyClientError(null, undefined, result.errorType);
        toast.error(
          getErrorMessageByType(
            errorType,
            result.error || 'Error al eliminar el servicio',
          ),
        );
      }
    } catch (error) {
      console.error(error);
      const errorType = classifyClientError(error);
      toast.error(getErrorMessageByType(errorType, 'Error al eliminar el servicio'));
    } finally {
      setLoading(false);
      setDeleteDialogOpen(false);
      setServiceToDelete(null);
    }
  };

  const fetchServices = React.useCallback(async () => {
      if (missingCompany) {
        setServices([]);
        setLoadError(null);
        setLoadingServices(false);
        return;
      }

      setLoadingServices(true);
      setLoadError(null);
      const result = await getServices(selectedCompany?.id ?? null, statusFilter);
      if (result.success) {
        setServices(result.data!);
      } else {
        const errorType = classifyClientError(null, undefined, result.errorType);
        setLoadError(
          getErrorMessageByType(
            errorType,
            result.error || 'No se pudieron cargar los servicios',
          ),
        );
      }
      setLoadingServices(false);
  }, [missingCompany, selectedCompany?.id, statusFilter]);

  React.useEffect(() => {
    void fetchServices();
  }, [fetchServices]);

  React.useEffect(() => {
    if (!importedFlag) {
      return;
    }
    void fetchServices();
    router.replace('/services');
  }, [importedFlag, fetchServices, router]);

  const filteredServices = useMemo(() => {
    const search = debouncedSearch.toLowerCase();
    return services.filter((service) => {
      return (
        service.name.toLowerCase().includes(search) ||
        service.description.toLowerCase().includes(search)
      );
    });
  }, [services, debouncedSearch]);

  const openDeleteDialog = React.useCallback((id: number) => {
    setServiceToDelete(id);
    setDeleteDialogOpen(true);
  }, []);

  const columns = useMemo(
    () =>
      createServicesColumns({
        renderActions: (service) =>
          canWrite ? (
            <>
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Editar ${service.name}`}
              onClick={(event) => {
                event.stopPropagation();
                router.push(`/services/${service.id}/edit`);
              }}
            >
              <Pencil className="h-4 w-4"  data-icon="inline-start" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Eliminar ${service.name}`}
              onClick={(event) => {
                event.stopPropagation();
                openDeleteDialog(service.id);
              }}
            >
              <Trash2 className="h-4 w-4 text-destructive"  data-icon="inline-start" />
            </Button>
            </>
          ) : null,
      }),
    [router, openDeleteDialog, canWrite],
  );

  const table = useReactTable({
    data: filteredServices,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const isBusy = loading || loadingServices;
  const hasActiveFilters = debouncedSearch !== '' || statusFilter !== 'active';
  const sheetFilterCount = statusFilter !== 'active' ? 1 : 0;
  const listState = resolveResourceListState({
    isLoading: isBusy,
    loadError,
    totalCount: services.length,
    visibleCount: filteredServices.length,
    hasActiveFilters,
  });
  const activeStatusLabel =
    statusFilter === 'active'
      ? 'Activos'
      : statusFilter === 'deleted'
        ? 'Eliminados'
        : 'Todos';

  const handleClearFilters = () => {
    setSearchValue('');
    setDebouncedSearch('');
    setStatusFilter('active');
    setSorting(DEFAULT_SERVICE_SORTING);
  };

  const filterChips = [
    {
      key: 'count',
      label: `${filteredServices.length} de ${services.length} servicios`,
      variant: 'secondary' as const,
    },
    ...(statusFilter !== 'active'
      ? [
          {
            key: 'status',
            label: activeStatusLabel,
          },
        ]
      : []),
    ...(debouncedSearch
      ? [
          {
            key: 'search',
            label: `Búsqueda: ${debouncedSearch}`,
          },
        ]
      : []),
  ];

  if (missingCompany) {
    return <SystemCompanyContextEmptyState resourceLabel="servicios" />;
  }

  return (
    <>
      <div className="space-y-4">
        <ServicesFilterBar
          searchValue={searchValue}
          onSearchChange={setSearchValue}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          sorting={sorting}
          onSortingChange={setSorting}
          sheetFilterCount={sheetFilterCount}
          hasActiveFilters={hasActiveFilters}
          onClearFilters={handleClearFilters}
          filterChips={filterChips}
        />
      </div>

      {listState.kind === 'loading' ? (
        <TripledListLoadingState
          label="Cargando lista de servicios"
          desktopColumns={4}
          desktopRows={5}
        />
      ) : listState.kind === 'error' ? (
        <TripledEmptyState
          icon={<Plus className="h-4 w-4"  data-icon="inline-start" />}
          title="Error de carga"
          description={listState.message}
          role="alert"
          action={
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                void fetchServices();
              }}
            >
              Reintentar
            </Button>
          }
        />
      ) : listState.kind === 'empty' ? (
        <TripledEmptyState
          icon={<Plus className="h-4 w-4"  data-icon="inline-start" />}
          title="Sin servicios"
          description={
            canWrite
              ? 'Agrega el primer servicio para completar el catálogo de esta empresa.'
              : 'No hay servicios registrados en este catálogo todavía.'
          }
          action={
            canWrite ? (
              <Button
                type="button"
                onClick={() => router.push('/services/new')}
              >
                <Plus className="mr-2 h-4 w-4" aria-hidden data-icon="inline-start" />
                Nuevo servicio
              </Button>
            ) : null
          }
        />
      ) : listState.kind === 'filtered-empty' ? (
        <TripledEmptyState
          icon={<Plus className="h-4 w-4"  data-icon="inline-start" />}
          title="Sin resultados"
          description="No encontramos servicios con esa búsqueda o esos filtros."
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
              const service = row.original;
              return (
                <TripledMobileRecordCard
                  key={row.id}
                  role="button"
                  tabIndex={canWrite ? 0 : -1}
                  aria-label={
                    canWrite
                      ? `Editar servicio ${service.name}`
                      : `Servicio ${service.name}`
                  }
                  interactive={canWrite}
                  className={
                    canWrite
                      ? 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
                      : undefined
                  }
                  onClick={() => {
                    if (canWrite) {
                      router.push(`/services/${service.id}/edit`);
                    }
                  }}
                  onKeyDown={(event) => {
                    if (
                      canWrite &&
                      (event.key === 'Enter' || event.key === ' ')
                    ) {
                      event.preventDefault();
                      router.push(`/services/${service.id}/edit`);
                    }
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <dl className="min-w-0 space-y-2">
                      <div>
                        <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                          Nombre
                        </dt>
                        <dd className="font-medium">{service.name}</dd>
                      </div>
                      <div>
                        <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                          Descripción
                        </dt>
                        <dd className="line-clamp-2 text-sm text-muted-foreground">
                          {service.description}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                          Precio
                        </dt>
                        <dd className="font-semibold tabular-nums">
                          <FormattedCurrency amount={service.price} />
                        </dd>
                      </div>
                    </dl>
                    <span
                      className={`inline-flex shrink-0 rounded-full px-2 py-1 text-xs font-medium ${
                        service.deleted_at
                          ? 'bg-destructive/10 text-destructive'
                          : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-100'
                      }`}
                    >
                      {service.deleted_at ? 'Eliminado' : 'Activo'}
                    </span>
                  </div>

                  {canWrite ? (
                    <div className="mt-4 flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Editar ${service.name}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        router.push(`/services/${service.id}/edit`);
                      }}
                    >
                      <Pencil className="h-4 w-4"  data-icon="inline-start" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Eliminar ${service.name}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        openDeleteDialog(service.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-destructive"  data-icon="inline-start" />
                    </Button>
                    </div>
                  ) : null}
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
                      <TableHead key={header.id} className={header.id === 'price' ? 'text-right' : undefined}>
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
                        router.push(`/services/${row.original.id}/edit`);
                      }
                    }}
                    onKeyDown={(event) => {
                      if (
                        canWrite &&
                        (event.key === 'Enter' || event.key === ' ')
                      ) {
                        event.preventDefault();
                        router.push(`/services/${row.original.id}/edit`);
                      }
                    }}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell
                        key={cell.id}
                        className={cell.column.id === 'price' ? 'text-right' : undefined}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción ocultará el servicio de la lista activa. Podrás verlo en
              el filtro de eliminados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => serviceToDelete && handleDelete(serviceToDelete)}
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
