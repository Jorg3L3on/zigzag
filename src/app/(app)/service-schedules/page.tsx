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
        {/* From lg the agenda draws its own title row; phones keep the card (ZIG-I30, ZIG-I33-5). */}
        <TripledResourceCard
          className="lg:contents"
          headerClassName="lg:hidden"
          contentClassName="lg:bg-transparent lg:p-0 lg:pt-0"
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
