import { describe, expect, it } from '@jest/globals';
import {
  getActiveMobileTabHref,
  getLongestMatchingHref,
  MOBILE_TAB_ITEMS,
  NAV_MAIN_ITEMS,
} from '@/lib/nav-items';

describe('nav-items', () => {
  it('defines field mobile tabs Hoy, Anotar, Clientes in order', () => {
    expect(MOBILE_TAB_ITEMS.map((item) => item.title)).toEqual([
      'Hoy',
      'Anotar',
      'Clientes',
    ]);
    expect(MOBILE_TAB_ITEMS.map((item) => item.url)).toEqual([
      '/dashboard',
      '/tickets/create',
      '/clients',
    ]);
  });

  it('does not put Tickets list or Cobranza on primary mobile tabs', () => {
    expect(MOBILE_TAB_ITEMS.some((item) => item.url === '/tickets')).toBe(
      false,
    );
    expect(MOBILE_TAB_ITEMS.some((item) => item.url === '/cobranza')).toBe(
      false,
    );
  });

  it('keeps full Plataforma sidebar list longer than mobile tabs', () => {
    expect(NAV_MAIN_ITEMS.length).toBeGreaterThan(MOBILE_TAB_ITEMS.length);
  });

  it('includes Cobranza in Plataforma nav with tickets.read', () => {
    const cobranza = NAV_MAIN_ITEMS.find((item) => item.url === '/cobranza');
    expect(cobranza?.title).toBe('Cobranza');
    expect(cobranza?.requiredPermission).toBe('tickets.read');
  });

  it('includes Presupuestos in Plataforma nav with tickets.read', () => {
    const presupuestos = NAV_MAIN_ITEMS.find(
      (item) => item.url === '/presupuestos',
    );
    expect(presupuestos?.title).toBe('Presupuestos');
    expect(presupuestos?.requiredPermission).toBe('tickets.read');
  });

  it('gates Anotar with tickets.write', () => {
    const anotar = MOBILE_TAB_ITEMS.find((item) => item.title === 'Anotar');
    expect(anotar?.requiredPermission).toBe('tickets.write');
  });

  it('activates Hoy on dashboard but not on tickets list', () => {
    expect(getActiveMobileTabHref('/dashboard')).toBe('/dashboard');
    expect(getActiveMobileTabHref('/tickets')).toBeNull();
    expect(getActiveMobileTabHref('/tickets/42')).toBeNull();
  });

  it('activates Anotar on ticket create only', () => {
    expect(getActiveMobileTabHref('/tickets/create')).toBe('/tickets/create');
    expect(getActiveMobileTabHref('/tickets')).toBeNull();
  });

  it('activates Clientes on client routes', () => {
    expect(getActiveMobileTabHref('/clients')).toBe('/clients');
    expect(getActiveMobileTabHref('/clients/3/edit')).toBe('/clients');
  });

  it('getLongestMatchingHref prefers longer prefix', () => {
    expect(
      getLongestMatchingHref('/tickets/create', [
        '/tickets',
        '/tickets/create',
      ]),
    ).toBe('/tickets/create');
  });
});
