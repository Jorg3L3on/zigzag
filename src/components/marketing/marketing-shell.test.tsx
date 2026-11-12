import { render, screen, within } from '@testing-library/react';
import { MarketingShell } from '@/components/marketing/marketing-shell';
import {
  MCP_DOCS_PATH,
  PRIVACY_PATH,
  TERMS_PATH,
} from '@/lib/marketing-routes';
import { ONBOARDING_GUIDE_PATHS } from '@/lib/onboarding-guides';

const renderShell = (showSectionNav?: boolean) =>
  render(
    <MarketingShell showSectionNav={showSectionNav}>
      <p>contenido</p>
    </MarketingShell>,
  );

describe('MarketingShell', () => {
  it('top bar: logo to /, Entrar to /login, Pedir acceso to #acceso and section links on the landing', () => {
    renderShell(true);
    const nav = screen.getByRole('navigation', { name: 'Principal' });

    expect(within(nav).getByRole('link', { name: 'ZigZag, inicio' })).toHaveAttribute(
      'href',
      '/',
    );
    expect(within(nav).getByRole('link', { name: 'Entrar' })).toHaveAttribute(
      'href',
      '/login',
    );
    expect(within(nav).getByRole('link', { name: 'Pedir acceso' })).toHaveAttribute(
      'href',
      '#acceso',
    );
    expect(
      within(nav)
        .getAllByRole('link')
        .map((link) => link.getAttribute('href')),
    ).toEqual(
      expect.arrayContaining(['#como-funciona', '#funciones', '#asistentes', '#preguntas']),
    );
  });

  it('other pages: no section links and Pedir acceso goes back to /#acceso', () => {
    renderShell();
    const nav = screen.getByRole('navigation', { name: 'Principal' });

    expect(screen.queryByTestId('marketing-section-nav')).toBeNull();
    expect(within(nav).getByRole('link', { name: 'Entrar' })).toHaveAttribute(
      'href',
      '/login',
    );
    expect(within(nav).getByRole('link', { name: 'Pedir acceso' })).toHaveAttribute(
      'href',
      '/#acceso',
    );
  });

  it('footer links guides, connector docs, legal pages and login', () => {
    renderShell();
    const footer = screen.getByRole('navigation', { name: 'Pie de página' });
    const href = (name: string) =>
      within(footer).getByRole('link', { name }).getAttribute('href');

    expect(href('Guías')).toBe(ONBOARDING_GUIDE_PATHS.index);
    expect(href('Conector para asistentes IA')).toBe(MCP_DOCS_PATH);
    expect(href('Aviso de privacidad')).toBe(PRIVACY_PATH);
    expect(href('Términos y condiciones')).toBe(TERMS_PATH);
    expect(href('Entrar')).toBe('/login');
  });
});
