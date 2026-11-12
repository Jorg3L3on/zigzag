import { render, screen, within } from '@testing-library/react';
import { MarketingLanding } from '@/components/marketing/marketing-landing';
import { MarketingShell } from '@/components/marketing/marketing-shell';
import { PRIVACY_PATH, TERMS_PATH } from '@/lib/marketing-routes';
import { ONBOARDING_GUIDE_PATHS } from '@/lib/onboarding-guides';

describe('MarketingLanding', () => {
  it('renders the Papel y tinta sections in canvas order, CTAs and footer links', () => {
    const { container } = render(
      <MarketingShell showSectionNav>
        <MarketingLanding />
      </MarketingShell>,
    );

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Haz el trabajo.Manda el recibo.Cobra completo.',
    );

    const ids = ['como-funciona', 'funciones', 'asistentes', 'preguntas', 'acceso'];
    for (const id of ids) {
      expect(document.getElementById(id)).toBeTruthy();
    }
    const sectionIds = Array.from(container.querySelectorAll('main section[id]')).map(
      (section) => section.id,
    );
    expect(sectionIds.filter((id) => ids.includes(id))).toEqual(ids);

    const sections = Array.from(container.querySelectorAll('main > section'));
    expect(sections).toHaveLength(9);
    expect(sections[0]).toHaveAttribute('aria-labelledby', 'landing-hero-title');
    expect(sections[8]).toHaveAttribute('id', 'acceso');

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
