import { TicketServicesListClient } from '@/components/tickets/ticket-services-list-client';

interface TicketServicesListProps {
  ticketId: string;
}

export async function TicketServicesList({
  ticketId,
}: TicketServicesListProps) {
  return <TicketServicesListClient ticketId={ticketId} />;
}
