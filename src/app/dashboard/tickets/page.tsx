import { Button } from '@/components/ui/button';
import { Plus, Ticket } from 'lucide-react';
import Link from 'next/link';
import TicketsList from '@/components/tickets/tickets-list';
import {
  TripledDashboardShell,
  TripledPageHeader,
  TripledResourceCard,
} from '@/components/tripled';
import { requirePagePermission } from '@/lib/page-authz';
import { getSessionPermissionMap } from '@/actions/authz';
import { canAccessPermission } from '@/lib/permissions';
import { canWriteTickets } from '@/lib/tickets-rbac';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function TicketsPage() {
  await requirePagePermission('tickets.read');
  const permissionMap = await getSessionPermissionMap();
  const canWrite = canWriteTickets((permission) =>
    canAccessPermission(permissionMap, permission),
  );

  return (
    <>
      <TripledPageHeader items={[{ label: 'Tickets' }]} />

      <TripledDashboardShell>
        <TripledResourceCard
          title="Tickets"
          description="Gestiona servicios, cobros y seguimiento."
          desktopDescription="Lista de todos los tickets registrados"
          icon={<Ticket className="size-5" aria-hidden />}
          action={
            canWrite ? (
              <Link
                href="/dashboard/tickets/create"
                className="w-full shrink-0 sm:w-auto sm:self-start"
              >
                <Button className="min-h-11 w-full gap-1.5 rounded-xl bg-primary px-4 text-sm font-semibold shadow-sm hover:bg-primary/90 sm:w-auto">
                  <Plus className="h-4 w-4 shrink-0" aria-hidden />
                  Nuevo Ticket
                </Button>
              </Link>
            ) : null
          }
        >
          <TicketsList />
        </TripledResourceCard>
      </TripledDashboardShell>
    </>
  );
}
