import { render, screen } from '@testing-library/react';
import { MarketingLegalPage } from '@/components/marketing/marketing-legal-page';
import {
  LEGAL_PLACEHOLDERS,
  PRIVACY_SECTIONS,
  TERMS_SECTIONS,
} from '@/components/marketing/marketing-legal-content';

describe('MarketingLegalPage', () => {
  it('renders privacy headings and placeholders', () => {
    render(
      <MarketingLegalPage
        title="Aviso de privacidad"
        description="Descripción de prueba"
        sections={PRIVACY_SECTIONS}
      />,
    );

    expect(
      screen.getByRole('heading', { level: 1, name: 'Aviso de privacidad' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: /Identidad del responsable/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: /Derechos ARCO/i }),
    ).toBeInTheDocument();
    expect(screen.getByTestId('legal-placeholder-responsable')).toHaveTextContent(
      LEGAL_PLACEHOLDERS.responsable,
    );
    expect(screen.getByTestId('legal-placeholder-email')).toHaveTextContent(
      LEGAL_PLACEHOLDERS.email,
    );
  });

  it('renders terms headings and placeholders', () => {
    render(
      <MarketingLegalPage
        title="Términos y condiciones"
        description="Descripción de prueba"
        sections={TERMS_SECTIONS}
      />,
    );

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'Términos y condiciones',
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: /Uso multi-empresa/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: /Limitación de responsabilidad/i }),
    ).toBeInTheDocument();
    expect(screen.getByTestId('legal-placeholder-vigencia')).toHaveTextContent(
      LEGAL_PLACEHOLDERS.vigencia,
    );
  });
});
