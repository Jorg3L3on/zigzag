import { DocumentDetailRouteLoading } from '@/components/route-loading-skeletons';

// Its own skeleton, so opening a ticket never shows the list's (ZIG-28).
export default function Loading() {
  return (
    <DocumentDetailRouteLoading
      breadcrumbs={[{ label: 'Tickets', href: '/tickets' }, { label: 'Ticket' }]}
      label="Cargando ticket"
    />
  );
}
