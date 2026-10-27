import type { Metadata } from 'next';
import { Button } from '@/components/ui/button';
import { Plus, Ticket } from 'lucide-react';
import Link from 'next/link';
import { DesktopSwitch } from '@/components/desktop-switch';
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

export const metadata: Metadata = {
  title: 'Tickets',
  description: 'Lista de todos los tickets registrados',
};

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
        {/* From lg the card steps aside: the list draws its title, the one Nuevo ticket
            and the table card (ZIG-I33-2). Phones keep the card as it was. */}
        <TripledResourceCard
          compactOnMobile
          desktop="title"
          headerClassName="lg:hidden"
          title="Tickets"
          description="Lista de todos los tickets registrados"
          icon={<Ticket className="size-5" aria-hidden />}
          action={
            canWrite ? (
              <DesktopSwitch
                phone={
                  <Button
                    asChild
                    className="min-h-11 w-full gap-1.5 rounded-xl bg-primary px-4 text-sm font-semibold shadow-sm hover:bg-primary/90 sm:w-auto sm:self-start"
                  >
                    <Link href="/tickets/create">
                      <Plus
                        className="h-4 w-4 shrink-0"
                        aria-hidden
                        data-icon="inline-start"
                      />
                      Nuevo ticket
                    </Link>
                  </Button>
                }
                desktop={null}
              />
            ) : null
          }
        >
          <TicketsList />
        </TripledResourceCard>
      </TripledDashboardShell>
    </>
  );
}
