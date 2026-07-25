import type { Metadata } from 'next';
import { MarketingLegalPage } from '@/components/marketing/marketing-legal-page';
import {
  LEGAL_DISCLAIMER,
  PRIVACY_SECTIONS,
} from '@/components/marketing/marketing-legal-content';
import { MARKETING_INDEXABLE_METADATA } from '@/lib/marketing-routes';

export const metadata: Metadata = {
  title: 'Aviso de privacidad | ZigZag',
  description:
    'Aviso de privacidad de ZigZag: responsable, finalidades, cookies de sesión, derechos ARCO y conservación.',
  robots: MARKETING_INDEXABLE_METADATA,
};

export default function AvisoDePrivacidadPage() {
  return (
    <MarketingLegalPage
      title="Aviso de privacidad"
      description={`Información sobre el tratamiento de datos personales en ZigZag. ${LEGAL_DISCLAIMER}`}
      sections={PRIVACY_SECTIONS}
    />
  );
}
