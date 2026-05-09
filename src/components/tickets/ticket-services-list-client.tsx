'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Service } from '@/db/schema';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { PlusCircle, CheckCircle2, Loader2 } from 'lucide-react';
import {
  ServiceTicket,
  createServiceTicket,
  updateServiceTicket,
  deleteServiceTicket,
  getTicketServices,
} from '@/actions/ticket-services';
import { useCompany } from '@/contexts/company-context';
import { getServices } from '@/actions/services';
import {
  TripledNativeDelete,
  TripledPageHeader,
  TripledStepper,
} from '@/components/tripled';
import {
  classifyClientError,
  getErrorMessageByType,
} from '@/lib/network-awareness';

export function TicketServicesListClient({ ticketId }: { ticketId: string }) {
  const router = useRouter();
  const { selectedCompany } = useCompany();
  const [services, setServices] = useState<Service[]>([]);
  const [ticketServices, setTicketServices] = useState<ServiceTicket[]>([]);
  const [selectedService, setSelectedService] = useState<string>('');
  const [quantity, setQuantity] = useState<string>('1');
  const [price, setPrice] = useState<string>('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredServices = services.filter(
    (service) =>
      service.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      service.description.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  React.useEffect(() => {
    const fetchServices = async () => {
      const result = await getServices(selectedCompany?.id ?? null);
      if (result.success) {
        setServices(result.data!);
      }
    };
    const fetchTicketServices = async () => {
      const result = await getTicketServices(ticketId);
      if (result.success) {
        setTicketServices(result.data!);
      }
    };
    fetchServices();
    fetchTicketServices();
  }, [selectedCompany, ticketId]);

  const resetForm = () => {
    setSelectedService('');
    setQuantity('1');
    setPrice('');
    setSearchTerm('');
  };

  const handleServiceSelect = (serviceId: string) => {
    setSelectedService(serviceId);
    const selectedServiceData = services.find(
      (s) => s.id.toString() === serviceId,
    );
    if (selectedServiceData) {
      setPrice(selectedServiceData.price.toString());
    }
  };

  const handleAddService = async () => {
    if (!selectedService || !quantity || !price) {
      toast.error('Por favor complete todos los campos');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await createServiceTicket(ticketId, {
        service_id: parseInt(selectedService),
        quantity: parseInt(quantity),
        price: parseFloat(price),
      });

      if (result.success && result.data) {
        setTicketServices([...ticketServices, result.data]);
        toast.success('Servicio agregado exitosamente');
        resetForm();
        setIsDialogOpen(false);
      } else {
        const errorType = classifyClientError(null, undefined, result.errorType);
        toast.error(
          getErrorMessageByType(
            errorType,
            result.error || 'Error al agregar el servicio',
          ),
        );
      }
    } catch (error) {
      console.error('Error al agregar servicio:', error);
      const errorType = classifyClientError(error);
      toast.error(
        getErrorMessageByType(errorType, 'Error al agregar el servicio'),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateService = async (
    serviceTicketId: number,
    newQuantity: number,
    newPrice: number,
  ) => {
    try {
      const result = await updateServiceTicket(ticketId, serviceTicketId, {
        quantity: newQuantity,
        price: newPrice,
      });

      if (result.success && result.data) {
        setTicketServices(
          ticketServices.map((st) =>
            st.id === serviceTicketId ? result.data! : st,
          ),
        );
        toast.success('Servicio actualizado exitosamente');
      } else {
        const errorType = classifyClientError(null, undefined, result.errorType);
        toast.error(
          getErrorMessageByType(
            errorType,
            result.error || 'Error al actualizar el servicio',
          ),
        );
      }
    } catch (error) {
      console.error('Error al actualizar servicio:', error);
      const errorType = classifyClientError(error);
      toast.error(
        getErrorMessageByType(errorType, 'Error al actualizar el servicio'),
      );
    }
  };

  const handleDeleteService = async (serviceTicketId: number) => {
    try {
      const result = await deleteServiceTicket(ticketId, serviceTicketId);

      if (result.success) {
        setTicketServices(
          ticketServices.filter((st) => st.id !== serviceTicketId),
        );
        toast.success('Servicio eliminado exitosamente');
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
      console.error('Error al eliminar servicio:', error);
      const errorType = classifyClientError(error);
      toast.error(
        getErrorMessageByType(errorType, 'Error al eliminar el servicio'),
      );
    }
  };

  const calculateTotal = () => {
    return ticketServices.reduce(
      (total, service) => total + service.quantity * service.price,
      0,
    );
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  return (
    <>
      <TripledPageHeader
        items={[
          { label: 'Tickets', href: '/dashboard/tickets' },
          { label: `Ticket #${ticketId}`, href: `/dashboard/tickets/${ticketId}/edit` },
          { label: 'Servicios' },
        ]}
      />

      <div className="flex flex-1 flex-col gap-6 p-6">
        <div className="mx-auto w-full">
          <TripledStepper
            steps={[
              { id: 'create', title: 'Datos del ticket' },
              { id: 'services', title: 'Servicios' },
              { id: 'review', title: 'Revisión y PDF' },
            ]}
            currentStepId="services"
          />
          <Card className="border-0 shadow-lg">
            <CardHeader className="space-y-4 pb-8">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <CardTitle className="text-xl">Servicios Asignados</CardTitle>
                  <CardDescription>
                    Lista de servicios asignados a este ticket
                  </CardDescription>
                </div>
                <Dialog
                  open={isDialogOpen}
                  onOpenChange={(open) => {
                    setIsDialogOpen(open);
                    if (!open) {
                      resetForm();
                    }
                  }}
                >
                  <DialogTrigger asChild>
                    <Button className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg hover:shadow-xl transition-all duration-200">
                      <PlusCircle className="mr-2 h-5 w-5" />
                      Agregar Servicio
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                      <DialogTitle className="text-2xl font-bold text-gray-800">
                        Agregar Nuevo Servicio
                      </DialogTitle>
                      <DialogDescription>
                        Selecciona un servicio y define cantidad y precio para
                        agregarlo al ticket.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-6 py-4">
                      <div className="space-y-3">
                        <Label className="text-sm font-medium text-foreground">
                          Servicio
                        </Label>
                        <Select
                          value={selectedService}
                          onValueChange={handleServiceSelect}
                        >
                          <SelectTrigger className="w-full h-12 border-2 focus:border-primary transition-colors">
                            <SelectValue placeholder="Seleccione un servicio" />
                          </SelectTrigger>
                          <SelectContent>
                            <div className="flex items-center px-3 pb-2">
                              <Input
                                placeholder="Buscar servicio..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="h-9"
                              />
                            </div>
                            <div className="max-h-[200px] overflow-y-auto">
                              {filteredServices.length === 0 ? (
                                <div className="px-3 py-2 text-sm text-gray-500">
                                  No se encontraron servicios
                                </div>
                              ) : (
                                filteredServices.map((service) => (
                                  <SelectItem
                                    key={service.id}
                                    value={service.id.toString()}
                                  >
                                    <div className="flex flex-col">
                                      <span>{service.name}</span>
                                      <span className="text-xs text-gray-500">
                                        {service.description}
                                      </span>
                                    </div>
                                  </SelectItem>
                                ))
                              )}
                            </div>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="grid gap-6 md:grid-cols-2">
                        <div className="space-y-3">
                          <Label className="text-sm font-medium text-foreground">
                            Cantidad
                          </Label>
                          <Input
                            type="number"
                            min="1"
                            value={quantity}
                            onChange={(e) => setQuantity(e.target.value)}
                            className="h-12 border-2 focus:border-primary transition-colors"
                          />
                        </div>

                        <div className="space-y-3">
                          <Label className="text-sm font-medium text-foreground">
                            Precio
                          </Label>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={price}
                            onChange={(e) => setPrice(e.target.value)}
                            className="h-12 border-2 focus:border-primary transition-colors"
                          />
                        </div>
                      </div>

                      <Button
                        onClick={handleAddService}
                        className="h-12 w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-medium transition-all duration-200 transform hover:scale-[1.02]"
                        disabled={isSubmitting}
                      >
                        {isSubmitting ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Agregando servicio...
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="mr-2 h-4 w-4" />
                            Agregar Servicio
                          </>
                        )}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {ticketServices.map((serviceTicket) => (
                <div
                  key={serviceTicket.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:shadow-md transition-shadow duration-200 bg-white"
                >
                  <div className="flex-1">
                    <h3 className="font-medium text-gray-800">
                      {serviceTicket.service.name}
                    </h3>
                    <p className="text-sm text-gray-500">
                      {serviceTicket.service.description}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div>
                      <Label className="text-gray-700">Cantidad</Label>
                      <Input
                        type="number"
                        min="1"
                        value={serviceTicket.quantity}
                        onChange={(e) =>
                          handleUpdateService(
                            serviceTicket.id,
                            parseInt(e.target.value),
                            serviceTicket.price,
                          )
                        }
                        className="w-20"
                      />
                    </div>
                    <div>
                      <Label className="text-gray-700">Precio</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={serviceTicket.price}
                        onChange={(e) =>
                          handleUpdateService(
                            serviceTicket.id,
                            serviceTicket.quantity,
                            parseFloat(e.target.value),
                          )
                        }
                        className="w-32"
                      />
                    </div>
                    <div>
                      <Label className="text-gray-700">Subtotal</Label>
                      <p className="text-lg font-medium">
                        {formatCurrency(
                          serviceTicket.quantity * serviceTicket.price,
                        )}
                      </p>
                    </div>
                    <div className="flex items-center">
                      <TripledNativeDelete
                        onDelete={() => handleDeleteService(serviceTicket.id)}
                        buttonText="Eliminar"
                        confirmLabel="Sí, eliminar"
                        className="mt-5"
                      />
                    </div>
                  </div>
                </div>
              ))}

              {ticketServices.length === 0 && (
                <div className="text-center py-12 text-gray-500 bg-gray-50 rounded-lg">
                  No hay servicios asignados a este ticket
                </div>
              )}

              <div className="mt-8 text-right border-t pt-4">
                <p className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  Total: {formatCurrency(calculateTotal())}
                </p>
              </div>

              <div className="mt-6 flex flex-col gap-3 border-t pt-6 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push(`/dashboard/tickets/${ticketId}/edit`)}
                >
                  Volver a datos del ticket
                </Button>
                <Button
                  type="button"
                  className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                  onClick={() => router.push(`/dashboard/tickets/${ticketId}/edit`)}
                >
                  Continuar a revisión
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
