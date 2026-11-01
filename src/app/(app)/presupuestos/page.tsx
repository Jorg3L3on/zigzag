import type { Metadata } from 'next';
import { PendingDocumentsStrip } from '@/components/field/pending-documents-strip';
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
        <PendingDocumentsStrip kind="presupuesto" />
        {/* From lg the card steps aside for the list's own title and table card (ZIG-I33-2). */}
        <TripledResourceCard
          desktop="title"
          headerClassName="lg:hidden"
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
