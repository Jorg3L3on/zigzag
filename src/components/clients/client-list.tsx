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
  const router = useRouter();

  const handleDelete = async (id: number) => {
    try {
      setLoading(true);
      const result = await deleteClient(id);
      if (result.success) {
        toast.success('Cliente eliminado correctamente');
        setClients(clients.filter((client) => client.id !== id));
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
      const result = await getClients(selectedCompany?.id ?? null);
      if (result.success) {
        setClients(result.data!);
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
  }, [selectedCompany]);

  const filteredClients = clients.filter((client) => {
    const search = searchValue.toLowerCase();

    return (
      client.name.toLowerCase().includes(search) ||
      (client.email ?? '').toLowerCase().includes(search) ||
      (client.phone ?? '').toLowerCase().includes(search)
    );
  });

  return (
    <>
      <TripledPageHeader items={[{ label: 'Clientes' }]} />

      <div className="flex flex-1 flex-col gap-6 p-6">
        <div className="mx-auto w-full max-w-5xl">
          <TripledDataPanel
            title="Catálogo de Clientes"
            description="Administra los clientes registrados."
            searchValue={searchValue}
            onSearchChange={setSearchValue}
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
            ) : filteredClients.length === 0 ? (
              <TripledEmptyState
                icon={<Plus className="h-4 w-4" />}
                title="Sin resultados"
                description="No encontramos clientes con ese filtro."
              />
            ) : (
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
                  {filteredClients.map((client) => (
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
