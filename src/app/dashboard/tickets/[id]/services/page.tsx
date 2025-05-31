import { TicketServicesList } from '@/components/tickets/ticket-services-list';

interface TicketServicesPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function TicketServicesPage({
  params,
}: TicketServicesPageProps) {
  const resolvedParams = await params;
  return <TicketServicesList ticketId={resolvedParams.id} />;
}
