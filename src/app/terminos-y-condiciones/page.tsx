import type { Metadata } from 'next';
import { MarketingLegalPage } from '@/components/marketing/marketing-legal-page';
import { MARKETING_INDEXABLE_METADATA } from '@/lib/marketing-routes';

export const metadata: Metadata = {
  title: 'Términos y condiciones | ZigZag',
  description: 'Términos y condiciones de uso de la plataforma ZigZag.',
  robots: MARKETING_INDEXABLE_METADATA,
};

export default function TerminosYCondicionesPage() {
  return (
    <MarketingLegalPage
      title="Términos y condiciones"
      description="Documento público de ZigZag. El texto completo con placeholders legales se publicará en la entrega de contenido legal."
    />
  );
}
