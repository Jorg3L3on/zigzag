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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Plus, Pencil, Trash2, Loader2, Search } from 'lucide-react';
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
  deleteService,
  getServices,
  type ServiceStatusFilter,
} from '@/actions/services';
import type { Service } from '@/db/schema';
import { useCompany } from '@/contexts/company-context';
import { TripledEmptyState } from '@/components/tripled';
import { classifyClientError, getErrorMessageByType } from '@/lib/network-awareness';
import { createServicesColumns } from '@/components/services/services-columns';
import {
  DEFAULT_SERVICE_SORTING,
  SERVICES_MOBILE_SORT_OPTIONS,
  decodeSortingState,
  encodeSortingState,
} from '@/components/services/services-sort-presets';
import { FormattedCurrency } from '@/components/formatted-currency';
import { usePermissions } from '@/hooks/use-permissions';
import { PERMISSIONS } from '@/lib/permissions';

export function ServicesListClient() {
  const { selectedCompany } = useCompany();
  const permissions = usePermissions();
  const canWriteServices = permissions.can(PERMISSIONS.services.write);
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

  const filterOptions: Array<{ value: ServiceStatusFilter; label: string }> = [
    { value: 'active', label: 'Activos' },
    { value: 'deleted', label: 'Eliminados' },
    { value: 'all', label: 'Todos' },
  ];

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
      const result = await deleteService(id);
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

  React.useEffect(() => {
    const fetchServices = async () => {
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
    };
    void fetchServices();
  }, [selectedCompany, statusFilter]);

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
          canWriteServices ? (
            <>
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Editar ${service.name}`}
              onClick={(event) => {
                event.stopPropagation();
                router.push(`/dashboard/services/${service.id}/edit`);
              }}
            >
              <Pencil className="h-4 w-4" />
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
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
            </>
          ) : null,
      }),
    [router, openDeleteDialog, canWriteServices],
  );

  const table = useReactTable({
    data: filteredServices,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const mobileSortValue = encodeSortingState(sorting);
  const isBusy = loading || loadingServices;

  return (
    <>
      <div className="space-y-4">
        <div className="relative max-w-sm">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={searchValue}
            onChange={(event) => setSearchValue(event.target.value)}
            placeholder="Buscar..."
            className="pl-9"
            aria-label="Buscar servicios"
          />
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2">
            {filterOptions.map((option) => (
              <Button
                key={option.value}
                type="button"
                variant={statusFilter === option.value ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter(option.value)}
                aria-label={`Filtrar por ${option.label.toLowerCase()}`}
              >
                {option.label}
              </Button>
            ))}
          </div>
          <div className="w-full sm:w-auto md:hidden">
            <Select
              value={mobileSortValue}
              onValueChange={(value) => setSorting(decodeSortingState(value))}
            >
              <SelectTrigger
                className="h-10 w-full sm:w-[min(100%,18rem)]"
                aria-label="Ordenar lista de servicios"
              >
                <SelectValue placeholder="Ordenar por" />
              </SelectTrigger>
              <SelectContent>
                {SERVICES_MOBILE_SORT_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <p className="text-xs text-muted-foreground sm:text-sm">
          Mostrando{' '}
          <span className="font-medium text-foreground">{filteredServices.length}</span>
          {services.length !== filteredServices.length ? (
            <>
              {' '}
              de{' '}
              <span className="font-medium text-foreground">{services.length}</span>
            </>
          ) : null}{' '}
          servicios
        </p>
      </div>

      {isBusy ? (
        <div className="flex h-32 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : loadError ? (
        <div className="space-y-4">
          <TripledEmptyState
            icon={<Plus className="h-4 w-4" />}
            title="Error de carga"
            description={loadError}
          />
          <div className="flex justify-center">
            <Button variant="outline" onClick={() => router.refresh()}>
              Reintentar
            </Button>
          </div>
        </div>
      ) : filteredServices.length === 0 ? (
        <TripledEmptyState
          icon={<Plus className="h-4 w-4" />}
          title="Sin resultados"
          description={
            services.length === 0
              ? 'No hay servicios en este catálogo todavía.'
              : 'No encontramos servicios con ese filtro.'
          }
        />
      ) : (
        <>
          <div className="space-y-3 md:hidden">
            {table.getRowModel().rows.map((row) => {
              const service = row.original;
              return (
                <article
                  key={row.id}
                  role="button"
                  tabIndex={canWriteServices ? 0 : -1}
                  aria-label={
                    canWriteServices
                      ? `Editar servicio ${service.name}`
                      : `Servicio ${service.name}`
                  }
                  className={`rounded-lg border border-border bg-card p-4 transition-colors ${
                    canWriteServices
                      ? 'cursor-pointer hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
                      : ''
                  }`}
                  onClick={() => {
                    if (canWriteServices) {
                      router.push(`/dashboard/services/${service.id}/edit`);
                    }
                  }}
                  onKeyDown={(event) => {
                    if (
                      canWriteServices &&
                      (event.key === 'Enter' || event.key === ' ')
                    ) {
                      event.preventDefault();
                      router.push(`/dashboard/services/${service.id}/edit`);
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
                          : 'bg-emerald-100 text-emerald-700'
                      }`}
                    >
                      {service.deleted_at ? 'Eliminado' : 'Activo'}
                    </span>
                  </div>

                  {canWriteServices ? (
                    <div className="mt-4 flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Editar ${service.name}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        router.push(`/dashboard/services/${service.id}/edit`);
                      }}
                    >
                      <Pencil className="h-4 w-4" />
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
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                    </div>
                  ) : null}
                </article>
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
                    className={canWriteServices ? 'cursor-pointer' : undefined}
                    tabIndex={canWriteServices ? 0 : -1}
                    onClick={() => {
                      if (canWriteServices) {
                        router.push(`/dashboard/services/${row.original.id}/edit`);
                      }
                    }}
                    onKeyDown={(event) => {
                      if (
                        canWriteServices &&
                        (event.key === 'Enter' || event.key === ' ')
                      ) {
                        event.preventDefault();
                        router.push(`/dashboard/services/${row.original.id}/edit`);
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
