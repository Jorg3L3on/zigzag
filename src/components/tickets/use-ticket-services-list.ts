import React, { useState } from 'react';
import type { Service } from '@/db/schema';
import { toast } from 'sonner';
import {
  type ServiceTicket,
  createServiceTicket,
  updateServiceTicket,
  deleteServiceTicket,
  getTicketServices,
} from '@/actions/ticket-services';
import { getServices } from '@/actions/services';
import {
  classifyClientError,
  getErrorMessageByType,
} from '@/lib/network-awareness';
import {
  sanitizeDecimal,
  sanitizeInteger,
} from '@/components/tickets/ticket-services-utils';

type UseTicketServicesListOptions = {
  ticketId: string;
  companyId: number | null | undefined;
  prefillServiceId?: string;
};

export const useTicketServicesList = ({
  ticketId,
  companyId,
  prefillServiceId,
}: UseTicketServicesListOptions) => {
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
      const result = await getServices(companyId ?? null);
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
  }, [companyId, ticketId]);

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
          setTicketServices((current) => [...current, result.data!]);
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
        setTicketServices((current) => [...current, result.data!]);
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
        setTicketServices((current) =>
          current.map((st) =>
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
    void handleUpdateService(serviceTicketId, sanitizeInteger(value), currentPrice);
  };

  const handleServicePriceChange = (
    serviceTicketId: number,
    currentQuantity: number,
    value: string,
  ) => {
    if (value === '') return;
    void handleUpdateService(
      serviceTicketId,
      currentQuantity,
      sanitizeDecimal(value),
    );
  };

  const handleDeleteService = async (serviceTicketId: number) => {
    try {
      const result = await deleteServiceTicket(ticketId, serviceTicketId);

      if (result.success) {
        setTicketServices((current) =>
          current.filter((st) => st.id !== serviceTicketId),
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

  const handleServiceCreated = (savedService: Service) => {
    setServices((prev) => {
      const exists = prev.some((s) => s.id === savedService.id);
      if (exists) {
        return prev;
      }
      return [savedService, ...prev];
    });
    setSelectedService(savedService.id.toString());
    setPrice(savedService.price.toString());
    setIsCreatingNewService(false);
  };

  return {
    services,
    ticketServices,
    filteredServices,
    selectedService,
    quantity,
    price,
    isDialogOpen,
    isSubmitting,
    searchTerm,
    isCreatingNewService,
    setIsDialogOpen,
    setSearchTerm,
    setQuantity,
    setPrice,
    setIsCreatingNewService,
    resetForm,
    handleServiceSelect,
    handleAddService,
    handleUpdateService,
    handleServiceQuantityChange,
    handleServicePriceChange,
    handleDeleteService,
    handleServiceCreated,
  };
};
