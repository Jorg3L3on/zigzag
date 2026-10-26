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

  return (
    <>
      <TripledPageHeader
        items={[{ label: 'Clientes', href: '/clients' }, { label: client.name }]}
        className="hidden md:flex"
      />
      <TripledDashboardShell maxWidthClassName="max-w-3xl">
        <TripledMobileAppBar title="Cliente" subtitle={client.name} backHref="/clients" className="mb-3" />
        <TripledResourceCard
          title="Cliente"
          description="Datos, saldo e historial del cliente."
          icon={<UserRound className="size-5" aria-hidden />}
          compactOnMobile
          contentClassName="space-y-6"
        >
          <ClientDetailHeader
            client={client}
            canWriteClients={canWriteClients}
            canWriteTickets={canWriteTickets}
          />
          <ClientBalanceCard
            clientId={client.id}
            balance={balance}
            clientName={client.name}
            phone={client.phone}
            tickets={tickets}
          />
          <ClientHistorySections
            tickets={tickets}
            presupuestos={presupuestos}
            payments={payments}
            schedules={schedules}
          />
          <ClientNotesCard
            clientId={client.id}
            initialNotes={client.notes}
            canWrite={canWriteClients}
          />
        </TripledResourceCard>
      </TripledDashboardShell>
    </>
  );
}
