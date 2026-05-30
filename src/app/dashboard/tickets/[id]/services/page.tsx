import { TicketServicesList } from '@/components/tickets/ticket-services-list';

interface TicketServicesPageProps {
  params: Promise<{
    id: string;
  }>;
  searchParams: Promise<{
    serviceId?: string;
  }>;
}

export default async function TicketServicesPage({
  params,
  searchParams,
}: TicketServicesPageProps) {
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;
  return (
    <TicketServicesList
      ticketId={resolvedParams.id}
      prefillServiceId={resolvedSearchParams.serviceId}
    />
  );
}
