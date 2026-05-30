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
import { PlusCircle, Plus, CheckCircle2, Loader2, Minus, Receipt } from 'lucide-react';
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
  TripledDashboardShell,
  TripledMobileAppBar,
  TripledNativeDelete,
  TripledPageHeader,
  TripledStepper,
} from '@/components/tripled';
import {
  classifyClientError,
  getErrorMessageByType,
} from '@/lib/network-awareness';
import { ServiceForm } from '@/components/services/service-form';

export function TicketServicesListClient({
  ticketId,
  prefillServiceId,
}: {
  ticketId: string;
  prefillServiceId?: string;
}) {
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

  const prefillHandledRef = React.useRef(false);

  React.useEffect(() => {
    if (
      prefillHandledRef.current ||
      !prefillServiceId ||
      services.length === 0 ||
      ticketServices.length > 0
    ) {
      return;
    }

    const serviceId = Number.parseInt(prefillServiceId, 10);
    if (!Number.isFinite(serviceId)) {
      return;
    }

    const catalogService = services.find((item) => item.id === serviceId);
    if (!catalogService) {
      return;
    }

    prefillHandledRef.current = true;

    const runPrefill = async () => {
      setIsSubmitting(true);
      try {
        const result = await createServiceTicket(ticketId, {
          service_id: serviceId,
          quantity: 1,
          price: catalogService.price,
        });
        if (result.success && result.data) {
          const added = result.data;
          setTicketServices((current) => [...current, added]);
          toast.success('Servicio agregado desde recordatorio');
        }
      } finally {
        setIsSubmitting(false);
      }
    };

    void runPrefill();
  }, [prefillServiceId, services, ticketId, ticketServices.length]);

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
      toast.error('Completa todos los campos para continuar. Código: TS002');
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
        className="hidden md:flex"
        items={[
          { label: 'Tickets', href: '/dashboard/tickets' },
          { label: `Ticket #${ticketId}`, href: `/dashboard/tickets/${ticketId}/edit` },
          { label: 'Servicios' },
        ]}
      />

      <TripledDashboardShell maxWidthClassName="max-w-2xl">
        <TripledMobileAppBar
          title={`Ticket #${ticketId}`}
          subtitle="Servicios"
          backHref={`/dashboard/tickets/${ticketId}/edit`}
          className="mb-3"
        />
        <div className="space-y-4">
          <TripledStepper
            steps={[
              { id: 'create', title: 'Datos del ticket' },
              { id: 'services', title: 'Servicios' },
              { id: 'review', title: 'Revisión y PDF' },
            ]}
            currentStepId="services"
          />
          <Card className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-xl ring-1 ring-black/5 dark:ring-white/10">
            <CardHeader className="border-b border-border/50 bg-gradient-to-br from-muted/35 via-background to-background px-5 py-6 sm:px-8 sm:py-7">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1.5">
                  <CardTitle className="text-balance text-2xl font-semibold tracking-tight">
                    Servicios Asignados
                  </CardTitle>
                  <CardDescription className="text-base">
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
                    <Button className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-md transition-all duration-200 hover:from-blue-700 hover:to-purple-700 hover:shadow-lg sm:w-auto">
                      <PlusCircle className="mr-2 h-5 w-5" />
                      Agregar Servicio
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="w-[calc(100vw-2rem)] max-w-[calc(100vw-2rem)] overflow-x-hidden sm:max-w-lg">
                    <DialogHeader>
                      <DialogTitle
                        data-initial-focus
                        tabIndex={-1}
                        className="text-2xl font-semibold text-foreground outline-none focus:outline-none"
                      >
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
                                      <div className="px-3 py-2 text-sm text-muted-foreground">
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
            <CardContent className="space-y-6 px-5 pb-8 pt-6 sm:px-8">
              {ticketServices.map((serviceTicket) => (
                <div
                  key={serviceTicket.id}
                  className="rounded-xl border border-border/60 bg-card p-4 shadow-sm transition-shadow duration-200 hover:border-border hover:shadow-md"
                >
                  <div className="space-y-4">
                    <h3 className="font-medium text-foreground">
                      {serviceTicket.service.name}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {serviceTicket.service.description}
                    </p>
                    <div className="grid gap-3 sm:grid-cols-2 sm:items-end">
                      <div>
                        <Label className="text-sm font-medium text-foreground">Cantidad</Label>
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
                        <Label className="text-sm font-medium text-foreground">Precio</Label>
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
                          <div className="relative w-full sm:w-40">
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
                      <div className="flex min-w-0 items-end justify-end gap-3 sm:col-span-2">
                        <div className="min-w-0 flex-1 rounded-md border border-border/60 bg-muted/30 p-3 text-right">
                          <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            Subtotal
                          </Label>
                          <p className="whitespace-nowrap text-xs font-semibold tabular-nums leading-tight text-foreground sm:text-base">
                            {formatCurrency(
                              serviceTicket.quantity * serviceTicket.price,
                            )}
                          </p>
                        </div>
                        <TripledNativeDelete
                          onDelete={() => handleDeleteService(serviceTicket.id)}
                          iconOnly
                          buttonText="Eliminar servicio"
                          confirmLabel="Sí, eliminar"
                          className="mt-0 self-end"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {ticketServices.length === 0 && (
                <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border/70 bg-muted/25 px-4 py-8 text-center text-sm text-muted-foreground">
                  <Receipt className="h-5 w-5 text-muted-foreground" aria-hidden />
                  <div className="space-y-1">
                    <p className="font-medium text-foreground">
                      No hay servicios asignados a este ticket
                    </p>
                    <p>
                      Usa <span className="font-semibold">Agregar Servicio</span> para añadir el primero.
                    </p>
                  </div>
                </div>
              )}

              <div className="mt-8 border-t border-border/60 pt-4">
                <div className="flex items-baseline justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Total
                  </span>
                  <span className="text-xl font-semibold tabular-nums text-foreground">
                    {formatCurrency(calculateTotal())}
                  </span>
                </div>
              </div>

              <div className="mt-6 flex flex-col gap-3 border-t border-border/60 pt-6 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  className="h-10 w-full sm:w-auto"
                  onClick={() =>
                    router.push(`/dashboard/tickets/${ticketId}/edit?step=create`)
                  }
                >
                  Volver a datos del ticket
                </Button>
                <Button
                  type="button"
                  className="h-11 w-full rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 text-base font-semibold text-white shadow-md transition-colors hover:from-blue-700 hover:to-purple-700 sm:w-auto"
                  disabled={ticketServices.length === 0}
                  onClick={() =>
                    router.push(`/dashboard/tickets/${ticketId}/edit?step=review`)
                  }
                >
                  Continuar a revisión
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </TripledDashboardShell>
    </>
  );
}
