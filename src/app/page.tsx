import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { MarketingLanding } from '@/components/marketing/marketing-landing';
import { MarketingShell } from '@/components/marketing/marketing-shell';
import { auth } from '@/lib/auth';
import {
  getMarketingSiteOrigin,
  MARKETING_INDEXABLE_METADATA,
} from '@/lib/marketing-routes';

const LANDING_TITLE = 'ZigZag · Haz el trabajo, manda el recibo, cobra completo';
const LANDING_DESCRIPTION =
  'ZigZag lleva tus tickets, presupuestos y cobros desde el teléfono. Sabes quién te debe y cuánto, y mandas el recibo por WhatsApp antes de irte.';

export const metadata: Metadata = {
  metadataBase: new URL(getMarketingSiteOrigin()),
  title: LANDING_TITLE,
  description: LANDING_DESCRIPTION,
  robots: MARKETING_INDEXABLE_METADATA,
  openGraph: {
    title: LANDING_TITLE,
    description: LANDING_DESCRIPTION,
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
