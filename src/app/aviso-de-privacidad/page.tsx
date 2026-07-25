import type { Metadata } from 'next';
import { MarketingLegalPage } from '@/components/marketing/marketing-legal-page';
import { MARKETING_INDEXABLE_METADATA } from '@/lib/marketing-routes';

export const metadata: Metadata = {
  title: 'Aviso de privacidad | ZigZag',
  description: 'Aviso de privacidad de la plataforma ZigZag.',
  robots: MARKETING_INDEXABLE_METADATA,
};

export default function AvisoDePrivacidadPage() {
  return (
    <MarketingLegalPage
      title="Aviso de privacidad"
      description="Documento público de ZigZag. El texto completo con placeholders legales se publicará en la entrega de contenido legal."
    />
  );
}
