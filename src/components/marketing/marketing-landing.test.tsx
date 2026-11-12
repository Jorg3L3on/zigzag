import { render, screen, within } from '@testing-library/react';
import { MarketingLanding } from '@/components/marketing/marketing-landing';
import { MarketingShell } from '@/components/marketing/marketing-shell';
import {
  LANDING_HERO,
  LANDING_PROBLEM,
} from '@/components/marketing/marketing-landing-content';
import { PRIVACY_PATH, TERMS_PATH } from '@/lib/marketing-routes';
import { ONBOARDING_GUIDE_PATHS } from '@/lib/onboarding-guides';

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

    // The old landing body still has its own "Iniciar sesión" CTAs until phase 7.
    const bodyLoginLinks = screen.getAllByRole('link', { name: 'Iniciar sesión' });
    expect(bodyLoginLinks[0]).toHaveAttribute('href', '/login');

    const howLinks = screen.getAllByRole('link', { name: 'Ver cómo funciona' });
    expect(howLinks[0]).toHaveAttribute('href', '#como-funciona');

    const nav = screen.getByRole('navigation', { name: 'Principal' });
    expect(within(nav).getByRole('link', { name: 'Entrar' })).toHaveAttribute(
      'href',
      '/login',
    );
    expect(
      within(nav).getByRole('link', { name: 'Pedir acceso' }),
    ).toHaveAttribute('href', '#acceso');

    const footer = screen.getByRole('navigation', { name: 'Pie de página' });
    expect(
      within(footer).getByRole('link', { name: 'Aviso de privacidad' }),
    ).toHaveAttribute('href', PRIVACY_PATH);
    expect(
      within(footer).getByRole('link', { name: 'Términos y condiciones' }),
    ).toHaveAttribute('href', TERMS_PATH);
    expect(within(footer).getByRole('link', { name: 'Guías' })).toHaveAttribute(
      'href',
      ONBOARDING_GUIDE_PATHS.index,
    );
  });
});
