import { describe, expect, it } from '@jest/globals';
import {
  filterSystemNavItems,
  getActiveMobileTabHref,
  getLongestMatchingHref,
  MOBILE_TAB_ITEMS,
  NAV_MAIN_ITEMS,
  NAV_SYSTEM_ITEMS,
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
      '/anotar',
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

  it('activates Anotar on /anotar', () => {
    expect(getActiveMobileTabHref('/anotar')).toBe('/anotar');
    expect(getActiveMobileTabHref('/tickets')).toBeNull();
    expect(getActiveMobileTabHref('/tickets/create')).toBeNull();
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

  it('nests Datos, Equipo and Roles under Mi empresa', () => {
    const company = NAV_MAIN_ITEMS.find((item) => item.title === 'Mi empresa');
    expect(company?.url).toBe('/company');
    expect(
      company?.items?.map((sub) => [sub.title, sub.url, sub.requiredPermission]),
    ).toEqual([
      ['Datos', '/company', 'company.manage'],
      ['Equipo', '/company/equipo', 'users.read'],
      ['Roles', '/company/roles', 'roles.read'],
    ]);
  });

  it('keeps Mi empresa sub-items active on nested hub routes', () => {
    const hubHrefs =
      NAV_MAIN_ITEMS.find((item) => item.title === 'Mi empresa')?.items?.map(
        (sub) => sub.url,
      ) ?? [];
    expect(getLongestMatchingHref('/company', hubHrefs)).toBe('/company');
    expect(getLongestMatchingHref('/company/equipo', hubHrefs)).toBe(
      '/company/equipo',
    );
    expect(getLongestMatchingHref('/company/roles/3', hubHrefs)).toBe(
      '/company/roles',
    );
  });

  it('shows Usuarios, Roles and Catálogo de permisos to system users only', () => {
    const adminPages = NAV_SYSTEM_ITEMS.filter((item) =>
      ['/users', '/roles', '/permissions'].includes(item.url),
    );
    expect(adminPages.map((item) => item.title)).toEqual([
      'Usuarios',
      'Roles',
      'Catálogo de permisos',
    ]);
    expect(adminPages.every((item) => item.systemOnly)).toBe(true);
  });

  it('leaves no tenant-visible item in Administración', () => {
    expect(NAV_SYSTEM_ITEMS.every((item) => item.systemOnly)).toBe(true);
  });

  it('hides Administración entirely for tenants, even with every permission', () => {
    expect(
      filterSystemNavItems(NAV_SYSTEM_ITEMS, { isSystemUser: false, can: () => true }),
    ).toEqual([]);
  });

  it('shows system users the full Administración list in order', () => {
    expect(
      filterSystemNavItems(NAV_SYSTEM_ITEMS, {
        isSystemUser: true,
        can: () => true,
      }).map((item) => item.title),
    ).toEqual([
      'Consola operadora',
      'Usuarios',
      'Empresas',
      'Roles',
      'Catálogo de permisos',
      'Auditoría',
      'Papelera',
    ]);
  });
});
