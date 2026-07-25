import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { MarketingLanding } from '@/components/marketing/marketing-landing';
import { MarketingShell } from '@/components/marketing/marketing-shell';
import { auth } from '@/lib/auth';
import {
  getMarketingSiteOrigin,
  MARKETING_INDEXABLE_METADATA,
} from '@/lib/marketing-routes';

export const metadata: Metadata = {
  metadataBase: new URL(getMarketingSiteOrigin()),
  title: 'ZigZag — Gestión de tickets y facturación para empresas de servicios',
  description:
    'Plataforma multi-empresa en español para tickets de servicio, cobranza y facturas PDF. Lista para móvil.',
  robots: MARKETING_INDEXABLE_METADATA,
  openGraph: {
    title: 'ZigZag — Tickets y facturación para empresas de servicios',
    description:
      'Opera clientes, servicios, cobros y facturas PDF en una sola plataforma multi-empresa.',
    locale: 'es_MX',
    type: 'website',
  },
};

export default async function HomePage() {
  const session = await auth();

  if (session?.user) {
    redirect(
      session.user.company_is_system ? '/operator-console' : '/dashboard',
    );
  }

  return (
    <MarketingShell showSectionNav>
      <MarketingLanding />
    </MarketingShell>
  );
}
