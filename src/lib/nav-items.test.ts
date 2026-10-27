import { describe, expect, it } from '@jest/globals';
import {
  filterSystemNavItems,
  getActiveMobileTabHref,
  getLongestMatchingHref,
  getVisibleNavMainItems,
  MOBILE_CREATE_ACTIONS,
  MOBILE_DOCK_CREATE_SLOT,
  MOBILE_TAB_ITEMS,
  NAV_MAIN_ITEMS,
  NAV_SYSTEM_ITEMS,
  type NavItemDefinition,
} from '@/lib/nav-items';

describe('nav-items', () => {
  it('defines mobile tabs Hoy, Tickets, Cobranza in order (ZIG-I18-6)', () => {
    expect(MOBILE_TAB_ITEMS.map((item) => item.title)).toEqual([
      'Hoy',
      'Tickets',
      'Cobranza',
    ]);
    expect(MOBILE_TAB_ITEMS.map((item) => item.url)).toEqual([
      '/dashboard',
      '/tickets',
      '/cobranza',
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

  it('does not put Anotar or Presupuestos on primary mobile tabs; they live in + and Más', () => {
    expect(MOBILE_TAB_ITEMS.some((item) => item.url === '/anotar')).toBe(false);
    expect(MOBILE_TAB_ITEMS.some((item) => item.url === '/presupuestos')).toBe(false);
    expect(MOBILE_CREATE_ACTIONS.some((a) => a.url === '/presupuestos/create')).toBe(true);
    expect(NAV_MAIN_ITEMS.some((item) => item.url === '/presupuestos')).toBe(true);
  });

  it('places the dock create slot between Tickets and Cobranza', () => {
    expect(MOBILE_DOCK_CREATE_SLOT).toBe(2);
    expect(MOBILE_TAB_ITEMS[MOBILE_DOCK_CREATE_SLOT - 1]?.title).toBe(
      'Tickets',
    );
    expect(MOBILE_TAB_ITEMS[MOBILE_DOCK_CREATE_SLOT]?.title).toBe(
      'Cobranza',
    );
  });

  it('defines create actions Nuevo ticket, Nuevo presupuesto, Anotar trabajo, Nuevo cliente', () => {
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
        title: 'Anotar trabajo',
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

  it('lists Anotar trabajo in the Más sheet only, gated by tickets.write', () => {
    const captura = NAV_MAIN_ITEMS.find((item) => item.url === '/anotar');
    expect(captura?.title).toBe('Anotar trabajo');
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
  });

  it('activates Cobranza on its route and subroutes', () => {
    expect(getActiveMobileTabHref('/cobranza')).toBe('/cobranza');
    expect(getActiveMobileTabHref('/cobranza/algo')).toBe('/cobranza');
  });

  it('presupuesto routes light no tab (Más) now that Cobranza has the slot', () => {
    expect(getActiveMobileTabHref('/presupuestos')).toBeNull();
    expect(getActiveMobileTabHref('/presupuestos/1069')).toBeNull();
    expect(getActiveMobileTabHref('/presupuestos/create')).toBeNull();
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

  it('Mi empresa is one link to the hub, without sub-items (ZIG-34)', () => {
    const company = NAV_MAIN_ITEMS.find((item) => item.title === 'Mi empresa');
    expect(company?.url).toBe('/company');
    expect(company?.requiredPermission).toBe('company.manage');
    expect(company?.items).toBeUndefined();
  });

  it('keeps Mi empresa active on every hub route', () => {
    const hrefs = NAV_MAIN_ITEMS.map((item) => item.activeUrl ?? item.url);
    for (const pathname of [
      '/company',
      '/company/equipo',
      '/company/roles',
      '/company/roles/nuevo',
      '/company/roles/3',
    ]) {
      expect(getLongestMatchingHref(pathname, hrefs)).toBe('/company');
    }
    expect(getLongestMatchingHref('/clients', hrefs)).toBe('/clients');
  });

  describe('getVisibleNavMainItems', () => {
    const canOnly =
      (...granted: string[]) =>
      (permission?: string) =>
        permission === undefined || granted.includes(permission);
    const find = (items: NavItemDefinition[]) =>
      items.find((item) => item.title === 'Mi empresa');

    it('sends an owner to Datos and lights the item under /company', () => {
      const company = find(
        getVisibleNavMainItems(NAV_MAIN_ITEMS, {
          can: canOnly('company.manage', 'users.read', 'roles.read'),
          isMobile: false,
        }),
      );
      expect(company?.url).toBe('/company');
      expect(company?.activeUrl).toBe('/company');
      expect(company?.items).toBeUndefined();
    });

    it('sends users.read without company.manage to Equipo', () => {
      const company = find(
        getVisibleNavMainItems(NAV_MAIN_ITEMS, {
          can: canOnly('users.read', 'roles.read'),
          isMobile: false,
        }),
      );
      expect(company?.url).toBe('/company/equipo');
      expect(company?.activeUrl).toBe('/company');
    });

    it('sends roles.read alone to Roles and hides Mi empresa with no hub permission', () => {
      expect(
        find(
          getVisibleNavMainItems(NAV_MAIN_ITEMS, {
            can: canOnly('roles.read'),
            isMobile: false,
          }),
        )?.url,
      ).toBe('/company/roles');
      expect(
        find(
          getVisibleNavMainItems(NAV_MAIN_ITEMS, {
            can: canOnly('tickets.read'),
            isMobile: false,
          }),
        ),
      ).toBeUndefined();
    });

    it('keeps permission filtering and mobileOnly for the other items', () => {
      const can = canOnly('tickets.read', 'tickets.write');
      const desktop = getVisibleNavMainItems(NAV_MAIN_ITEMS, { can, isMobile: false });
      expect(desktop.map((item) => item.title)).toEqual([
        'Inicio',
        'Tickets',
        'Cobranza',
        'Presupuestos',
        'Recordatorios de servicio',
      ]);
      const mobile = getVisibleNavMainItems(NAV_MAIN_ITEMS, { can, isMobile: true });
      expect(mobile.map((item) => item.title)).toContain('Anotar trabajo');
    });

    it('still filters sub-items by permission for grouped items', () => {
      const grouped: NavItemDefinition[] = [
        {
          title: 'Grupo',
          url: '/grupo',
          requiredPermission: 'grupo.manage',
          items: [
            { title: 'A', url: '/grupo/a', requiredPermission: 'a.read' },
            { title: 'B', url: '/grupo/b', requiredPermission: 'b.read' },
          ],
        },
      ];
      expect(
        getVisibleNavMainItems(grouped, { can: canOnly('b.read'), isMobile: false })[0]
          ?.items,
      ).toEqual([{ title: 'B', url: '/grupo/b', requiredPermission: 'b.read' }]);
      expect(
        getVisibleNavMainItems(grouped, { can: canOnly('x'), isMobile: false }),
      ).toEqual([]);
    });
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
