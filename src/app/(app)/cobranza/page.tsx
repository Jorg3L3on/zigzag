import type { Metadata } from 'next';
import { Banknote } from 'lucide-react';
import { CobranzaView } from '@/components/cobranza/cobranza-view';
import {
  TripledDashboardShell,
  TripledPageHeader,
  TripledResourceCard,
} from '@/components/tripled';
import { requirePagePermission } from '@/lib/page-authz';

export const metadata: Metadata = {
  title: 'Cobranza',
  description: 'Saldos de tickets terminados por cobrar',
};

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function CobranzaPage() {
  await requirePagePermission('tickets.read');

  return (
    <>
      <TripledPageHeader
        items={[
          { label: 'Hoy', href: '/dashboard' },
          { label: 'Cobranza' },
        ]}
      />

      <TripledDashboardShell>
        {/* From md the view draws its own title and strip, without the card (ZIG-I31-2). */}
        <TripledResourceCard
          className="md:contents"
          headerClassName="md:hidden"
          contentClassName="md:bg-transparent md:p-0 md:pt-0"
          title="Cobranza"
          description="Quién te debe y desde cuándo."
          icon={<Banknote className="size-5" aria-hidden />}
        >
          <CobranzaView />
        </TripledResourceCard>
      </TripledDashboardShell>
    </>
  );
}
