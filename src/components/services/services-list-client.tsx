'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Plus, Pencil, Trash2, Loader2 } from 'lucide-react';
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
import {
  TripledDataPanel,
  TripledEmptyState,
  TripledPageHeader,
} from '@/components/tripled';
import { classifyClientError, getErrorMessageByType } from '@/lib/network-awareness';

export function ServicesListClient() {
  const { selectedCompany } = useCompany();
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingServices, setLoadingServices] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [serviceToDelete, setServiceToDelete] = useState<number | null>(null);
  const [searchValue, setSearchValue] = useState('');
  const [statusFilter, setStatusFilter] = useState<ServiceStatusFilter>('active');
  const router = useRouter();

  const filterOptions: Array<{ value: ServiceStatusFilter; label: string }> = [
    { value: 'active', label: 'Activos' },
    { value: 'deleted', label: 'Eliminados' },
    { value: 'all', label: 'Todos' },
  ];

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

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
    fetchServices();
  }, [selectedCompany, statusFilter]);

  const filteredServices = services.filter((service) => {
    const search = searchValue.toLowerCase();
    return (
      service.name.toLowerCase().includes(search) ||
      service.description.toLowerCase().includes(search)
    );
  });

  return (
    <>
      <TripledPageHeader items={[{ label: 'Servicios' }]} />

      <div className="flex flex-1 flex-col gap-6 p-6">
        <div className="mx-auto w-full max-w-5xl">
          <TripledDataPanel
            title="Catálogo de Servicios"
            description="Administra los servicios disponibles."
            searchValue={searchValue}
            onSearchChange={setSearchValue}
            ctaLabel="Nuevo Servicio"
            onCtaClick={() => router.push('/dashboard/services/new')}
          >
            <div className="mb-4 flex flex-wrap gap-2">
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

            {loading || loadingServices ? (
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
                description="No encontramos servicios con ese filtro."
              />
            ) : (
              <>
                <div className="space-y-3 md:hidden">
                  {filteredServices.map((service) => (
                    <div
                      key={service.id}
                      role="button"
                      tabIndex={0}
                      aria-label={`Editar servicio ${service.name}`}
                      className="cursor-pointer rounded-lg border border-border bg-card p-4 transition-colors hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      onClick={() => router.push(`/dashboard/services/${service.id}/edit`)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          router.push(`/dashboard/services/${service.id}/edit`);
                        }
                      }}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <p className="font-medium">{service.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {service.description}
                          </p>
                        </div>
                        <p className="shrink-0 text-sm font-semibold">
                          {formatCurrency(service.price)}
                        </p>
                      </div>
                      <div className="mt-3">
                        <span
                          className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
                            service.deleted_at
                              ? 'bg-destructive/10 text-destructive'
                              : 'bg-emerald-100 text-emerald-700'
                          }`}
                        >
                          {service.deleted_at ? 'Eliminado' : 'Activo'}
                        </span>
                      </div>

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
                            setServiceToDelete(service.id);
                            setDeleteDialogOpen(true);
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="hidden md:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nombre</TableHead>
                        <TableHead>Descripción</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead className="text-right">Precio</TableHead>
                        <TableHead className="text-right">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredServices.map((service) => (
                        <TableRow
                          key={service.id}
                          className="cursor-pointer"
                          tabIndex={0}
                          onClick={() => router.push(`/dashboard/services/${service.id}/edit`)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault();
                              router.push(`/dashboard/services/${service.id}/edit`);
                            }
                          }}
                        >
                          <TableCell className="font-medium">{service.name}</TableCell>
                          <TableCell>{service.description}</TableCell>
                          <TableCell>
                            <span
                              className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
                                service.deleted_at
                                  ? 'bg-destructive/10 text-destructive'
                                  : 'bg-emerald-100 text-emerald-700'
                              }`}
                            >
                              {service.deleted_at ? 'Eliminado' : 'Activo'}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(service.price)}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
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
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setServiceToDelete(service.id);
                                  setDeleteDialogOpen(true);
                                }}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </TripledDataPanel>
        </div>
      </div>

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
