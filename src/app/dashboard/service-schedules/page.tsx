import type { Metadata } from 'next';
import {
  TripledDashboardShell,
  TripledPageHeader,
  TripledResourceCard,
} from '@/components/tripled';
import { ServiceSchedulesList } from '@/components/service-schedules/service-schedules-list';
import { requirePagePermission } from '@/lib/page-authz';
import { CalendarClock } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Recordatorios de servicio',
  description: 'Próximos servicios programados por cliente',
};

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function ServiceSchedulesPage() {
  await requirePagePermission('tickets.read');

  return (
    <>
      <TripledPageHeader
        items={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Recordatorios de servicio' },
        ]}
      />

      <TripledDashboardShell>
        <TripledResourceCard
          title="Recordatorios de servicio"
          description="Clientes y servicios con próxima visita programada."
          desktopDescription="Gestiona recordatorios por cliente y servicio"
          icon={<CalendarClock className="size-5" aria-hidden />}
        >
          <ServiceSchedulesList />
        </TripledResourceCard>
      </TripledDashboardShell>
    </>
  );
};
