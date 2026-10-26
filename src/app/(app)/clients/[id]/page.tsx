import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { UserRound } from 'lucide-react';

import { getClientDetail } from '@/actions/client-detail';
import { getSessionPermissionMap } from '@/actions/authz';
import { ClientBalanceCard } from '@/components/clients/detail/client-balance-card';
import { ClientDetailHeader } from '@/components/clients/detail/client-detail-header';
import { ClientHistorySections } from '@/components/clients/detail/client-history-sections';
import { ClientNotesCard } from '@/components/clients/detail/client-notes-card';
import {
  TripledDashboardShell,
  TripledMobileAppBar,
  TripledPageHeader,
  TripledResourceCard,
} from '@/components/tripled';
import { requirePagePermission } from '@/lib/page-authz';
import { canAccessPermission, PERMISSIONS } from '@/lib/permissions';

export const metadata: Metadata = {
  title: 'Cliente',
  description: 'Historial y saldo del cliente',
};

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type ClientDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function ClientDetailPage({ params }: ClientDetailPageProps) {
  await requirePagePermission('clients.read');
  const { id } = await params;
  const clientId = Number(id);
  if (!Number.isInteger(clientId) || clientId <= 0) {
    notFound();
  }

  const result = await getClientDetail(clientId);
  if (!result.success || !result.data) {
    notFound();
  }
  const { client, balance, tickets, presupuestos, payments, schedules } = result.data;

  const permissionMap = await getSessionPermissionMap();
  const canWriteClients = canAccessPermission(permissionMap, PERMISSIONS.clients.write);
  const canWriteTickets = canAccessPermission(permissionMap, PERMISSIONS.tickets.write);
  const lastTicketDate = tickets.reduce<string | null>((latest, row) => {
    const date = row.ticketDate ?? row.createdAt;
    return latest == null || new Date(date) > new Date(latest) ? date : latest;
  }, null);

  return (
    <>
      <TripledPageHeader
        items={[{ label: 'Clientes', href: '/clients' }, { label: client.name }]}
        className="hidden md:flex"
      />
      <TripledDashboardShell maxWidthClassName="max-w-3xl lg:max-w-[1200px]">
        <TripledMobileAppBar title="Cliente" subtitle={client.name} backHref="/clients" className="mb-3" />
        {/* From lg the page draws its own title, without the card (like Cobranza and the ticket detail). */}
        <TripledResourceCard
          title="Cliente"
          description="Datos, saldo e historial del cliente."
          icon={<UserRound className="size-5" aria-hidden />}
          compactOnMobile
          className="lg:contents"
          headerClassName="lg:hidden"
          contentClassName="lg:bg-transparent lg:p-0 lg:pt-0"
        >
          {/* A container, not lg: with the sidebar open 1024 leaves ~720 px, so two columns
              only from 60rem of page (the ticket detail rule). DOM order is the phone order;
              from 60rem the grid puts the history left and Saldo, Datos and Notas right. */}
          <div className="@container">
            <div className="space-y-6 @min-[60rem]:grid @min-[60rem]:grid-cols-[minmax(0,1fr)_320px] @min-[60rem]:grid-rows-[auto_auto_auto_auto_1fr] @min-[60rem]:items-start @min-[60rem]:gap-x-8 @min-[60rem]:gap-y-4 @min-[60rem]:space-y-0 @min-[72rem]:grid-cols-[minmax(0,1fr)_340px]">
              <ClientDetailHeader
                client={client}
                canWriteClients={canWriteClients}
                canWriteTickets={canWriteTickets}
                ticketCount={balance.ticketCount}
                presupuestoCount={presupuestos.length}
                lastTicketDate={lastTicketDate}
                // Single column on desktop (1024 with the sidebar): the buttons right under the
                // name, Datos after them. Datos holds nothing focusable, so tab order stays.
                className="lg:space-y-0 lg:@max-[60rem]:flex lg:@max-[60rem]:flex-col lg:@max-[60rem]:gap-4 @min-[60rem]:contents"
                titleClassName="@min-[60rem]:col-span-2 @min-[60rem]:row-start-1 @min-[60rem]:mb-0"
                detailsClassName="lg:@max-[60rem]:order-last @min-[60rem]:mb-0 @min-[60rem]:col-start-2 @min-[60rem]:row-start-4"
                actionsClassName="@min-[60rem]:col-span-2 @min-[60rem]:row-start-2 @min-[60rem]:mb-4"
              />
              <ClientBalanceCard
                clientId={client.id}
                balance={balance}
                clientName={client.name}
                phone={client.phone}
                tickets={tickets}
                className="@min-[60rem]:col-start-2 @min-[60rem]:row-start-3"
              />
              <ClientHistorySections
                tickets={tickets}
                presupuestos={presupuestos}
                payments={payments}
                schedules={schedules}
                className="@min-[60rem]:col-start-1 @min-[60rem]:row-span-3 @min-[60rem]:row-start-3"
              />
              <ClientNotesCard
                clientId={client.id}
                initialNotes={client.notes}
                canWrite={canWriteClients}
                className="@min-[60rem]:col-start-2 @min-[60rem]:row-start-5"
              />
            </div>
          </div>
        </TripledResourceCard>
      </TripledDashboardShell>
    </>
  );
}
