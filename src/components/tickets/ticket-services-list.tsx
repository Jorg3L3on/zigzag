import { TicketServicesListClient } from '@/components/tickets/ticket-services-list-client';

interface TicketServicesListProps {
  ticketId: string;
  prefillServiceId?: string;
}

export async function TicketServicesList({
  ticketId,
  prefillServiceId,
}: TicketServicesListProps) {
  return (
    <TicketServicesListClient
      ticketId={ticketId}
      prefillServiceId={prefillServiceId}
    />
  );
}
