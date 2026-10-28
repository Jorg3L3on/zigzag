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
        {/* From lg the card dissolves and the list draws its own title row (ZIG-I33-8). */}
        <TripledResourceCard
          desktop="title"
          headerClassName="lg:hidden"
          title="Auditoría"
          description="Visible solo para usuarios de la empresa System."
          icon={<ClipboardList className="size-5" aria-hidden />}
        >
          <AuditList />
        </TripledResourceCard>
      </TripledDashboardShell>
    </>
  );
}
