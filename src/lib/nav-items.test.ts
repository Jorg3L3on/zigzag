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

  it('resolves nested ticket paths to /tickets', () => {
    expect(
      getLongestMatchingHref('/tickets/12/edit', [
        '/dashboard',
        '/tickets',
        '/clients',
      ]),
    ).toBe('/tickets');
  });
});
