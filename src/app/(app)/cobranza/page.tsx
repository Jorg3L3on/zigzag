import type { Metadata } from 'next';
import { Banknote } from 'lucide-react';
import { CobranzaList } from '@/components/cobranza/cobranza-list';
import {
  TripledDashboardShell,
  TripledPageHeader,
  TripledResourceCard,
} from '@/components/tripled';
import { requirePagePermission } from '@/lib/page-authz';

export const metadata: Metadata = {
  title: 'Cobranza',
  description: 'Tickets con saldo pendiente por cobrar',
};

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function CobranzaPage() {
  await requirePagePermission('tickets.read');

  return (
    <>
      <TripledPageHeader
        items={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Cobranza' },
        ]}
      />

      <TripledDashboardShell>
        <TripledResourceCard
          title="Cobranza"
          description="Tickets con saldo pendiente. Prioriza pendientes y saldos antiguos."
          desktopDescription="Cola de cobro por estado y antigüedad"
          icon={<Banknote className="size-5" aria-hidden />}
        >
          <CobranzaList />
        </TripledResourceCard>
      </TripledDashboardShell>
    </>
  );
}
