import { describe, expect, it } from '@jest/globals';
import {
  filterSystemNavItems,
  getActiveMobileTabHref,
  getLongestMatchingHref,
  MOBILE_CREATE_ACTIONS,
  MOBILE_DOCK_CREATE_SLOT,
  MOBILE_TAB_ITEMS,
  NAV_MAIN_ITEMS,
  NAV_SYSTEM_ITEMS,
} from '@/lib/nav-items';

describe('nav-items', () => {
  it('defines mobile tabs Hoy, Tickets, Presupuestos in order', () => {
    expect(MOBILE_TAB_ITEMS.map((item) => item.title)).toEqual([
      'Hoy',
      'Tickets',
      'Presupuestos',
    ]);
    expect(MOBILE_TAB_ITEMS.map((item) => item.url)).toEqual([
      '/dashboard',
      '/tickets',
      '/presupuestos',
    ]);
  });

  it('keeps Clientes out of the dock tabs but in the Más list', () => {
    expect(MOBILE_TAB_ITEMS.some((item) => item.url === '/clients')).toBe(false);
    expect(NAV_MAIN_ITEMS.some((item) => item.url === '/clients')).toBe(true);
  });

  it('gates the Tickets tab with tickets.read', () => {
    const tickets = MOBILE_TAB_ITEMS.find((item) => item.title === 'Tickets');
    expect(tickets?.requiredPermission).toBe('tickets.read');
  });

  it('does not put Anotar or Cobranza on primary mobile tabs', () => {
    expect(MOBILE_TAB_ITEMS.some((item) => item.url === '/anotar')).toBe(
      false,
    );
    expect(MOBILE_TAB_ITEMS.some((item) => item.url === '/cobranza')).toBe(
      false,
    );
  });

  it('places the dock create slot between Tickets and Presupuestos', () => {
    expect(MOBILE_DOCK_CREATE_SLOT).toBe(2);
    expect(MOBILE_TAB_ITEMS[MOBILE_DOCK_CREATE_SLOT - 1]?.title).toBe(
      'Tickets',
    );
    expect(MOBILE_TAB_ITEMS[MOBILE_DOCK_CREATE_SLOT]?.title).toBe(
      'Presupuestos',
    );
  });

  it('defines create actions Nuevo ticket, Nuevo presupuesto, Captura rápida, Nuevo cliente', () => {
    expect(
      MOBILE_CREATE_ACTIONS.map(({ title, url, requiredPermission }) => ({
        title,
        url,
        requiredPermission,
      })),
    ).toEqual([
      {
        title: 'Nuevo ticket',
        url: '/tickets/create',
        requiredPermission: 'tickets.write',
      },
      {
        title: 'Nuevo presupuesto',
        url: '/presupuestos/create',
        requiredPermission: 'tickets.write',
      },
      {
        title: 'Captura rápida',
        url: '/anotar',
        requiredPermission: 'tickets.write',
      },
      {
        title: 'Nuevo cliente',
        url: '/clients/new',
        requiredPermission: 'clients.write',
      },
    ]);
    expect(MOBILE_CREATE_ACTIONS.every((action) => action.hint.length > 0)).toBe(
      true,
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

  it('lists Captura rápida in the Más sheet only, gated by tickets.write', () => {
    const captura = NAV_MAIN_ITEMS.find((item) => item.url === '/anotar');
    expect(captura?.title).toBe('Captura rápida');
    expect(captura?.requiredPermission).toBe('tickets.write');
    expect(captura?.mobileOnly).toBe(true);
  });

  it('activates Hoy on dashboard only', () => {
    expect(getActiveMobileTabHref('/dashboard')).toBe('/dashboard');
    expect(getActiveMobileTabHref('/tickets')).not.toBe('/dashboard');
  });

  it('activates Tickets on the list, create and detail routes', () => {
    expect(getActiveMobileTabHref('/tickets')).toBe('/tickets');
    expect(getActiveMobileTabHref('/tickets/create')).toBe('/tickets');
    expect(getActiveMobileTabHref('/tickets/42')).toBe('/tickets');
    expect(getActiveMobileTabHref('/tickets/42/services')).toBe('/tickets');
  });

  it('does not activate Tickets on look-alike prefixes', () => {
    expect(getActiveMobileTabHref('/ticketsx')).toBeNull();
  });

  it('returns null (Más) on /anotar and other non-tab routes', () => {
    expect(getActiveMobileTabHref('/anotar')).toBeNull();
    expect(getActiveMobileTabHref('/cobranza')).toBeNull();
  });

  it('activates Presupuestos on its list, detail and create routes', () => {
    expect(getActiveMobileTabHref('/presupuestos')).toBe('/presupuestos');
    expect(getActiveMobileTabHref('/presupuestos/1069')).toBe('/presupuestos');
    expect(getActiveMobileTabHref('/presupuestos/create')).toBe('/presupuestos');
  });

  it('returns null (Más) on client routes now that Clientes is not a tab', () => {
    expect(getActiveMobileTabHref('/clients')).toBeNull();
    expect(getActiveMobileTabHref('/clients/3/edit')).toBeNull();
  });

  it('respects the visible tab subset (permissions)', () => {
    const withoutTickets = MOBILE_TAB_ITEMS.filter(
      (item) => item.url !== '/tickets',
    );
    expect(getActiveMobileTabHref('/tickets/42', withoutTickets)).toBeNull();
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
