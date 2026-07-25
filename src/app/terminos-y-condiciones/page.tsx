import type { Metadata } from 'next';
import { MarketingLegalPage } from '@/components/marketing/marketing-legal-page';
import {
  LEGAL_DISCLAIMER,
  TERMS_SECTIONS,
} from '@/components/marketing/marketing-legal-content';
import { MARKETING_INDEXABLE_METADATA } from '@/lib/marketing-routes';

export const metadata: Metadata = {
  title: 'Términos y condiciones | ZigZag',
  description:
    'Términos y condiciones de ZigZag: cuenta, uso multi-empresa, uso aceptable y limitación de responsabilidad.',
  robots: MARKETING_INDEXABLE_METADATA,
};

export default function TerminosYCondicionesPage() {
  return (
    <MarketingLegalPage
      title="Términos y condiciones"
      description={`Condiciones de uso de la plataforma ZigZag. ${LEGAL_DISCLAIMER}`}
      sections={TERMS_SECTIONS}
    />
  );
}
