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
import { Client, deleteClient, getClients } from '@/actions/clients';
import { useCompany } from '@/contexts/company-context';
import {
  TripledDataPanel,
  TripledEmptyState,
  TripledPageHeader,
} from '@/components/tripled';
import { classifyClientError, getErrorMessageByType } from '@/lib/network-awareness';

export function ClientList() {
  const { selectedCompany } = useCompany();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingClients, setLoadingClients] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [clientToDelete, setClientToDelete] = useState<number | null>(null);
  const [searchValue, setSearchValue] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(12);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const router = useRouter();

  React.useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSearch(searchValue.trim());
    }, 300);

    return () => window.clearTimeout(timeoutId);
  }, [searchValue]);

  const handleDelete = async (id: number) => {
    try {
      setLoading(true);
      const result = await deleteClient(id, selectedCompany?.id ?? null);
      if (result.success) {
        toast.success('Cliente eliminado correctamente');
        if (clients.length === 1 && page > 1) {
          setPage((prevPage) => prevPage - 1);
        } else {
          const clientsResult = await getClients({
            companyId: selectedCompany?.id ?? null,
            page,
            pageSize,
            search: debouncedSearch,
          });
          if (clientsResult.success && clientsResult.data) {
            setClients(clientsResult.data.items);
            setTotal(clientsResult.data.total);
            setTotalPages(clientsResult.data.totalPages);
          }
        }
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

  React.useEffect(() => {
    const fetchClients = async () => {
      setLoadingClients(true);
      setLoadError(null);
      const result = await getClients({
        companyId: selectedCompany?.id ?? null,
        page,
        pageSize,
        search: debouncedSearch,
      });
      if (result.success && result.data) {
        setClients(result.data.items);
        setTotal(result.data.total);
        setTotalPages(result.data.totalPages);
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
    };
    fetchClients();
  }, [selectedCompany, page, pageSize, debouncedSearch]);

  const handleSearchChange = (value: string) => {
    setSearchValue(value);
    setPage(1);
  };

  return (
    <>
      <TripledPageHeader items={[{ label: 'Clientes' }]} />

      <div className="flex flex-1 flex-col gap-6 p-6">
        <div className="mx-auto w-full max-w-5xl">
          <TripledDataPanel
            title="Catálogo de Clientes"
            description="Administra los clientes registrados."
            searchValue={searchValue}
            onSearchChange={handleSearchChange}
            ctaLabel="Nuevo Cliente"
            onCtaClick={() => router.push('/dashboard/clients/new')}
          >
            {loading || loadingClients ? (
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
            ) : clients.length === 0 ? (
              <TripledEmptyState
                icon={<Plus className="h-4 w-4" />}
                title="Sin resultados"
                description="No encontramos clientes con ese filtro."
              />
            ) : (
              <>
                <div className="space-y-3 md:hidden">
                  {clients.map((client) => (
                    <article
                      key={client.id}
                      className="cursor-pointer rounded-lg border bg-card p-4 shadow-sm transition-colors hover:bg-accent/30"
                      tabIndex={0}
                      role="button"
                      aria-label={`Editar cliente ${client.name}`}
                      onClick={() => router.push(`/dashboard/clients/${client.id}/edit`)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          router.push(`/dashboard/clients/${client.id}/edit`);
                        }
                      }}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <h3 className="text-sm font-semibold text-foreground">{client.name}</h3>
                        <div className="flex shrink-0 gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Editar ${client.name}`}
                            onClick={(event) => {
                              event.stopPropagation();
                              router.push(`/dashboard/clients/${client.id}/edit`);
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Eliminar ${client.name}`}
                            onClick={(event) => {
                              event.stopPropagation();
                              setClientToDelete(client.id);
                              setDeleteDialogOpen(true);
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>

                      <dl className="mt-3 space-y-2 text-sm">
                        <div className="grid grid-cols-[88px_1fr] gap-2">
                          <dt className="text-muted-foreground">Telefono</dt>
                          <dd className="truncate">{client.phone || '-'}</dd>
                        </div>
                        <div className="grid grid-cols-[88px_1fr] gap-2">
                          <dt className="text-muted-foreground">Email</dt>
                          <dd className="truncate">{client.email || '-'}</dd>
                        </div>
                        <div className="grid grid-cols-[88px_1fr] gap-2">
                          <dt className="text-muted-foreground">Direccion</dt>
                          <dd className="line-clamp-2">{client.address || '-'}</dd>
                        </div>
                      </dl>
                    </article>
                  ))}
                </div>

                <div className="hidden md:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nombre</TableHead>
                        <TableHead>Teléfono</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Dirección</TableHead>
                        <TableHead className="text-right">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {clients.map((client) => (
                        <TableRow
                          key={client.id}
                          className="cursor-pointer"
                          tabIndex={0}
                          onClick={() => router.push(`/dashboard/clients/${client.id}/edit`)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault();
                              router.push(`/dashboard/clients/${client.id}/edit`);
                            }
                          }}
                        >
                          <TableCell className="font-medium">{client.name}</TableCell>
                          <TableCell>{client.phone}</TableCell>
                          <TableCell>{client.email || '-'}</TableCell>
                          <TableCell>{client.address || '-'}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                aria-label={`Editar ${client.name}`}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  router.push(`/dashboard/clients/${client.id}/edit`);
                                }}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                aria-label={`Eliminar ${client.name}`}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setClientToDelete(client.id);
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
                <div className="mt-4 flex items-center justify-between gap-3 border-t pt-4">
                  <p className="text-xs text-muted-foreground">
                    {total} clientes totales - Pagina {page} de {totalPages}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((prevPage) => Math.max(1, prevPage - 1))}
                      disabled={page <= 1 || loadingClients}
                    >
                      Anterior
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setPage((prevPage) => Math.min(totalPages, prevPage + 1))
                      }
                      disabled={page >= totalPages || loadingClients}
                    >
                      Siguiente
                    </Button>
                  </div>
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
