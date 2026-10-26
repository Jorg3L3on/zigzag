import type { Metadata } from 'next';
import { FileText } from 'lucide-react';
import { PresupuestosList } from '@/components/presupuestos/presupuestos-list';
import {
  TripledDashboardShell,
  TripledPageHeader,
  TripledResourceCard,
} from '@/components/tripled';
import { requirePagePermission } from '@/lib/page-authz';

export const metadata: Metadata = {
  title: 'Presupuestos',
  description: 'Cotizaciones convertibles a tickets de trabajo',
};

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function PresupuestosPage() {
  await requirePagePermission('tickets.read');

  return (
    <>
      <TripledPageHeader
        items={[
          { label: 'Hoy', href: '/dashboard' },
          { label: 'Presupuestos' },
        ]}
      />

      <TripledDashboardShell>
        {/* From md the card steps aside for the table's own header (ZIG-I29-3). */}
        <TripledResourceCard
          className="md:contents"
          headerClassName="md:hidden"
          contentClassName="md:bg-transparent md:p-0 md:pt-0"
          title="Presupuestos"
          description="Cola comercial de presupuestos"
          icon={<FileText className="size-5" aria-hidden />}
        >
          <PresupuestosList />
        </TripledResourceCard>
      </TripledDashboardShell>
    </>
  );
}
