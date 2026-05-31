import {
  TripledDashboardShell,
  TripledPageHeader,
  TripledResourceCard,
} from '@/components/tripled';
import { AuditList } from '@/components/audit/audit-list';
import { requireSystemPage } from '@/lib/page-authz';
import { ClipboardList } from 'lucide-react';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function AuditPage() {
  await requireSystemPage();

  return (
    <>
      <TripledPageHeader items={[{ label: 'Auditoría' }]} />

      <TripledDashboardShell>
        <TripledResourceCard
          title="Auditoría"
          description="Registro unificado de actividad de la plataforma."
          desktopDescription="Visible solo para usuarios de la empresa System."
          icon={<ClipboardList className="size-5" aria-hidden />}
        >
          <AuditList />
        </TripledResourceCard>
      </TripledDashboardShell>
    </>
  );
}
