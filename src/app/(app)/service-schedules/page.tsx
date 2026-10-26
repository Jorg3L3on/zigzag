import type { Metadata } from 'next';
import {
  TripledDashboardShell,
  TripledPageHeader,
  TripledResourceCard,
} from '@/components/tripled';
import { ServiceSchedulesView } from '@/components/service-schedules/service-schedules-view';
import { requirePagePermission } from '@/lib/page-authz';
import { SERVICE_SCHEDULES_READ_PERMISSION } from '@/lib/service-schedules-rbac';
import { CalendarClock } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Recordatorios de servicio',
  description: 'Próximos servicios programados por cliente',
};

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function ServiceSchedulesPage() {
  await requirePagePermission(SERVICE_SCHEDULES_READ_PERMISSION);

  return (
    <>
      <TripledPageHeader
        items={[
          { label: 'Hoy', href: '/dashboard' },
          { label: 'Recordatorios de servicio' },
        ]}
      />

      <TripledDashboardShell>
        {/* From md the agenda draws its own title row; phones keep the card (ZIG-I30). */}
        <TripledResourceCard
          className="md:contents"
          headerClassName="md:hidden"
          contentClassName="md:bg-transparent md:p-0 md:pt-0"
          title="Recordatorios de servicio"
          description="Gestiona recordatorios por cliente y servicio"
          icon={<CalendarClock className="size-5" aria-hidden />}
        >
          <ServiceSchedulesView />
        </TripledResourceCard>
      </TripledDashboardShell>
    </>
  );
};
