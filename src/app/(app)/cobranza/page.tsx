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
          { label: 'Hoy', href: '/dashboard' },
          { label: 'Cobranza' },
        ]}
      />

      <TripledDashboardShell>
        <TripledResourceCard
          title="Cobranza"
          description="Quién te debe y desde cuándo."
          icon={<Banknote className="size-5" aria-hidden />}
        >
          <CobranzaList />
        </TripledResourceCard>
      </TripledDashboardShell>
    </>
  );
}
