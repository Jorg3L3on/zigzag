import { render, screen } from '@testing-library/react';
import { MarketingLanding } from '@/components/marketing/marketing-landing';
import { MarketingShell } from '@/components/marketing/marketing-shell';
import {
  LANDING_HERO,
  LANDING_PROBLEM,
} from '@/components/marketing/marketing-landing-content';
import { PRIVACY_PATH, TERMS_PATH } from '@/lib/marketing-routes';

describe('MarketingLanding', () => {
  it('renders key sections, CTAs, and footer legal links', () => {
    render(
      <MarketingShell showSectionNav>
        <MarketingLanding />
      </MarketingShell>,
    );

    expect(
      screen.getByRole('heading', { level: 1, name: LANDING_HERO.headline }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: LANDING_PROBLEM.title }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Cómo funciona' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Capacidades' }),
    ).toBeInTheDocument();
    expect(document.getElementById('como-funciona')).toBeTruthy();

    const loginLinks = screen.getAllByRole('link', { name: 'Iniciar sesión' });
    expect(loginLinks.length).toBeGreaterThanOrEqual(2);
    expect(loginLinks[0]).toHaveAttribute('href', '/login');

    const howLinks = screen.getAllByRole('link', { name: 'Ver cómo funciona' });
    expect(howLinks[0]).toHaveAttribute('href', '#como-funciona');

    expect(
      screen.getByRole('link', { name: 'Aviso de privacidad' }),
    ).toHaveAttribute('href', PRIVACY_PATH);
    expect(
      screen.getByRole('link', { name: 'Términos y condiciones' }),
    ).toHaveAttribute('href', TERMS_PATH);
    expect(
      screen.getByRole('link', { name: 'Guías de producto' }),
    ).toHaveAttribute('href', '/guides');
  });
});
