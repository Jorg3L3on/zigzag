import { describe, expect, it } from '@jest/globals';
import {
  getLongestMatchingHref,
  MOBILE_TAB_ITEMS,
  NAV_MAIN_ITEMS,
} from '@/lib/nav-items';

describe('nav-items', () => {
  it('marks Inicio, Tickets, and Clientes as mobile tabs', () => {
    expect(MOBILE_TAB_ITEMS.map((item) => item.url)).toEqual([
      '/dashboard',
      '/tickets',
      '/clients',
    ]);
  });

  it('keeps full Plataforma list longer than mobile tabs', () => {
    expect(NAV_MAIN_ITEMS.length).toBeGreaterThan(MOBILE_TAB_ITEMS.length);
  });

  it('includes Cobranza in Plataforma nav with tickets.read', () => {
    const cobranza = NAV_MAIN_ITEMS.find((item) => item.url === '/cobranza');
    expect(cobranza?.title).toBe('Cobranza');
    expect(cobranza?.requiredPermission).toBe('tickets.read');
    expect(MOBILE_TAB_ITEMS.some((item) => item.url === '/cobranza')).toBe(
      false,
    );
  });

  it('includes Presupuestos in Plataforma nav with tickets.read', () => {
    const presupuestos = NAV_MAIN_ITEMS.find(
      (item) => item.url === '/presupuestos',
    );
    expect(presupuestos?.title).toBe('Presupuestos');
    expect(presupuestos?.requiredPermission).toBe('tickets.read');
  });
});
