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
import { PlusCircle, Plus, CheckCircle2, Loader2, Minus } from 'lucide-react';
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
import { ServiceForm } from '@/components/services/service-form';

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
  const [isCreatingNewService, setIsCreatingNewService] = useState(false);

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
    setIsCreatingNewService(false);
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

  const sanitizeInteger = (value: string, fallback = 1) => {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.max(parsed, 1);
  };

  const sanitizeDecimal = (value: string, fallback = 0) => {
    const parsed = Number.parseFloat(value);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.max(parsed, 0);
  };

  const updateDraftQuantity = (nextValue: number) => {
    setQuantity(String(Math.max(nextValue, 1)));
  };

  const updateDraftPrice = (nextValue: number) => {
    setPrice(String(Math.max(nextValue, 0)));
  };

  const handleAddService = async () => {
    if (!selectedService || !quantity || !price) {
      toast.error('Por favor complete todos los campos');
      return;
    }

    setIsSubmitting(true);
    try {
      const parsedQuantity = sanitizeInteger(quantity);
      const parsedPrice = sanitizeDecimal(price);

      const result = await createServiceTicket(ticketId, {
        service_id: parseInt(selectedService),
        quantity: parsedQuantity,
        price: parsedPrice,
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

  const handleServiceQuantityChange = (
    serviceTicketId: number,
    currentPrice: number,
    value: string,
  ) => {
    if (value === '') return;
    handleUpdateService(serviceTicketId, sanitizeInteger(value), currentPrice);
  };

  const handleServicePriceChange = (
    serviceTicketId: number,
    currentQuantity: number,
    value: string,
  ) => {
    if (value === '') return;
    handleUpdateService(serviceTicketId, currentQuantity, sanitizeDecimal(value));
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

      <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6">
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
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
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
                    <Button className="w-full sm:w-auto bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg hover:shadow-xl transition-all duration-200">
                      <PlusCircle className="mr-2 h-5 w-5" />
                      Agregar Servicio
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="w-[calc(100vw-2rem)] max-w-[calc(100vw-2rem)] overflow-x-hidden sm:max-w-lg">
                    <DialogHeader>
                      <DialogTitle className="text-2xl font-bold text-gray-800">
                        {isCreatingNewService
                          ? 'Crear nuevo servicio'
                          : 'Agregar servicio al ticket'}
                      </DialogTitle>
                      <DialogDescription>
                        {isCreatingNewService
                          ? 'El servicio quedará guardado en el catálogo de tu empresa y podrás agregarlo a este ticket.'
                          : 'Selecciona un servicio existente o crea uno nuevo. Define cantidad y precio para agregarlo al ticket.'}
                      </DialogDescription>
                    </DialogHeader>
                    {isCreatingNewService ? (
                      <div className="py-2">
                        <ServiceForm
                          onCancel={() => setIsCreatingNewService(false)}
                          onSuccess={(savedService) => {
                            setServices((prev) => {
                              const exists = prev.some(
                                (s) => s.id === savedService.id,
                              );
                              if (exists) {
                                return prev;
                              }
                              return [savedService, ...prev];
                            });
                            setSelectedService(savedService.id.toString());
                            setPrice(savedService.price.toString());
                            setIsCreatingNewService(false);
                          }}
                        />
                      </div>
                    ) : (
                      <div className="grid min-w-0 gap-6 py-4">
                        <div className="space-y-3">
                          <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-end">
                            <div className="min-w-0 flex-1 space-y-3">
                              <Label className="text-sm font-medium text-foreground">
                                Servicio
                              </Label>
                              <Select
                                value={selectedService}
                                onValueChange={handleServiceSelect}
                              >
                                <SelectTrigger className="h-auto min-h-12 w-full items-start whitespace-normal border-2 py-2 transition-colors focus:border-primary [&>span]:block [&>span]:max-w-[calc(100%-1.5rem)] [&>span]:whitespace-normal [&>span]:break-words [&>span]:text-left">
                                  <SelectValue placeholder="Seleccione un servicio" />
                                </SelectTrigger>
                                <SelectContent className="max-w-[calc(100vw-3rem)]">
                                  <div className="flex items-center px-3 pb-2">
                                    <Input
                                      placeholder="Buscar servicio..."
                                      value={searchTerm}
                                      onChange={(e) =>
                                        setSearchTerm(e.target.value)
                                      }
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
                                          textValue={service.name}
                                          className="items-start whitespace-normal py-2"
                                        >
                                          <span className="block whitespace-normal break-words pr-2 leading-snug">
                                            {service.name}
                                          </span>
                                        </SelectItem>
                                      ))
                                    )}
                                  </div>
                                </SelectContent>
                              </Select>
                            </div>
                            <Button
                              type="button"
                              variant="outline"
                              className="h-12 shrink-0 sm:mt-0"
                              onClick={() => setIsCreatingNewService(true)}
                            >
                              <Plus className="mr-2 h-4 w-4" />
                              Nuevo servicio
                            </Button>
                          </div>
                        </div>

                        <div className="grid min-w-0 gap-6 md:grid-cols-2">
                          <div className="space-y-3">
                            <Label className="text-sm font-medium text-foreground">
                              Cantidad
                            </Label>
                            <div className="flex items-center gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                className="h-12 w-12 shrink-0"
                                onClick={() =>
                                  updateDraftQuantity(sanitizeInteger(quantity) - 1)
                                }
                                aria-label="Reducir cantidad"
                              >
                                <Minus className="h-4 w-4" />
                              </Button>
                              <Input
                                type="number"
                                min="1"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                value={quantity}
                                onChange={(e) =>
                                  setQuantity(e.target.value.replace(/[^\d]/g, ''))
                                }
                                onBlur={() => updateDraftQuantity(sanitizeInteger(quantity))}
                                className="h-12 border-2 text-center focus:border-primary transition-colors"
                              />
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                className="h-12 w-12 shrink-0"
                                onClick={() =>
                                  updateDraftQuantity(sanitizeInteger(quantity) + 1)
                                }
                                aria-label="Aumentar cantidad"
                              >
                                <Plus className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>

                          <div className="space-y-3">
                            <Label className="text-sm font-medium text-foreground">
                              Precio
                            </Label>
                            <div className="flex items-center gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                className="h-12 w-12 shrink-0"
                                onClick={() =>
                                  updateDraftPrice(
                                    Number((sanitizeDecimal(price) - 1).toFixed(2)),
                                  )
                                }
                                aria-label="Reducir precio"
                              >
                                <Minus className="h-4 w-4" />
                              </Button>
                              <div className="relative flex-1">
                                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                                  $
                                </span>
                                <Input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  inputMode="decimal"
                                  value={price}
                                  onChange={(e) => setPrice(e.target.value)}
                                  onBlur={() =>
                                    updateDraftPrice(sanitizeDecimal(price))
                                  }
                                  className="h-12 border-2 pl-8 text-center focus:border-primary transition-colors"
                                />
                              </div>
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                className="h-12 w-12 shrink-0"
                                onClick={() =>
                                  updateDraftPrice(
                                    Number((sanitizeDecimal(price) + 1).toFixed(2)),
                                  )
                                }
                                aria-label="Aumentar precio"
                              >
                                <Plus className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </div>

                        <Button
                          type="button"
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
                              Agregar al ticket
                            </>
                          )}
                        </Button>
                      </div>
                    )}
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {ticketServices.map((serviceTicket) => (
                <div
                  key={serviceTicket.id}
                  className="rounded-lg border bg-white p-4 transition-shadow duration-200 hover:shadow-md"
                >
                  <div className="space-y-4">
                    <h3 className="font-medium text-gray-800">
                      {serviceTicket.service.name}
                    </h3>
                    <p className="text-sm text-gray-500">
                      {serviceTicket.service.description}
                    </p>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[auto_auto_1fr_auto] lg:items-end">
                      <div>
                        <Label className="text-gray-700">Cantidad</Label>
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="h-10 w-10 shrink-0"
                            onClick={() =>
                              handleUpdateService(
                                serviceTicket.id,
                                Math.max(serviceTicket.quantity - 1, 1),
                                serviceTicket.price,
                              )
                            }
                            aria-label="Reducir cantidad del servicio"
                          >
                            <Minus className="h-4 w-4" />
                          </Button>
                          <Input
                            type="number"
                            min="1"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            value={serviceTicket.quantity}
                            onChange={(e) =>
                              handleServiceQuantityChange(
                                serviceTicket.id,
                                serviceTicket.price,
                                e.target.value,
                              )
                            }
                            className="w-full text-center sm:w-24"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="h-10 w-10 shrink-0"
                            onClick={() =>
                              handleUpdateService(
                                serviceTicket.id,
                                serviceTicket.quantity + 1,
                                serviceTicket.price,
                              )
                            }
                            aria-label="Aumentar cantidad del servicio"
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      <div>
                        <Label className="text-gray-700">Precio</Label>
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="h-10 w-10 shrink-0"
                            onClick={() =>
                              handleUpdateService(
                                serviceTicket.id,
                                serviceTicket.quantity,
                                Math.max(
                                  Number((serviceTicket.price - 1).toFixed(2)),
                                  0,
                                ),
                              )
                            }
                            aria-label="Reducir precio del servicio"
                          >
                            <Minus className="h-4 w-4" />
                          </Button>
                          <div className="relative w-full sm:w-36">
                            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                              $
                            </span>
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              inputMode="decimal"
                              value={serviceTicket.price}
                              onChange={(e) =>
                                handleServicePriceChange(
                                  serviceTicket.id,
                                  serviceTicket.quantity,
                                  e.target.value,
                                )
                              }
                              className="w-full pl-8 text-center"
                            />
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="h-10 w-10 shrink-0"
                            onClick={() =>
                              handleUpdateService(
                                serviceTicket.id,
                                serviceTicket.quantity,
                                Number((serviceTicket.price + 1).toFixed(2)),
                              )
                            }
                            aria-label="Aumentar precio del servicio"
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      <div className="rounded-md border bg-gray-50 p-3 lg:ml-2">
                        <Label className="text-gray-700">Subtotal</Label>
                        <p className="text-lg font-medium">
                          {formatCurrency(
                            serviceTicket.quantity * serviceTicket.price,
                          )}
                        </p>
                      </div>
                      <div className="flex items-end lg:justify-end">
                        <TripledNativeDelete
                          onDelete={() => handleDeleteService(serviceTicket.id)}
                          buttonText="Eliminar"
                          confirmLabel="Sí, eliminar"
                          className="w-full lg:mt-5"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {ticketServices.length === 0 && (
                <div className="text-center py-12 text-gray-500 bg-gray-50 rounded-lg">
                  No hay servicios asignados a este ticket
                </div>
              )}

              <div className="mt-8 border-t pt-4 text-right">
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
