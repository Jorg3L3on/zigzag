import { getServices } from '@/actions/services';
import { getTicketServices } from '@/actions/ticket-services';
import { TicketServicesListClient } from '@/components/tickets/ticket-services-list-client';

interface TicketServicesListProps {
  ticketId: string;
}

export async function TicketServicesList({
  ticketId,
}: TicketServicesListProps) {
  const [servicesResult, ticketServicesResult] = await Promise.all([
    getServices(),
    getTicketServices(ticketId),
  ]);

  if (!servicesResult.success) {
    throw new Error(servicesResult.error || 'Error al cargar los servicios');
  }

  if (!ticketServicesResult.success) {
    throw new Error(
      ticketServicesResult.error || 'Error al cargar los servicios del ticket',
    );
  }

  return (
    <TicketServicesListClient
      initialServices={servicesResult.data!}
      initialTicketServices={ticketServicesResult.data!}
      ticketId={ticketId}
    />
  );
}
