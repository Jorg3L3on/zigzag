import {
  Banknote,
  Building,
  CalendarClock,
  ClipboardList,
  Home,
  Key,
  Package,
  PenLine,
  Shield,
  Ticket,
  Trash2,
  User,
  UserPlus,
  type LucideIcon,
} from 'lucide-react';

import {
  COMPANY_HUB_PATH,
  COMPANY_HUB_ROLES_PATH,
  COMPANY_HUB_TEAM_PATH,
} from '@/lib/company-hub';
import { PERMISSIONS } from '@/lib/permissions';
import { SERVICE_SCHEDULES_READ_PERMISSION } from '@/lib/service-schedules-rbac';

export type NavItemDefinition = {
  title: string;
  url: string;
  icon?: LucideIcon;
  requiredPermission?: string;
  systemOnly?: boolean;
  /** When true, item is a primary mobile bottom-tab destination (legacy flag; prefer MOBILE_TAB_ITEMS). */
  mobileTab?: boolean;
  /** When true, item only shows in the mobile Más sheet (desktop sidebar IA unchanged). */
  mobileOnly?: boolean;
  items?: {
    title: string;
    url: string;
    requiredPermission?: string;
  }[];
};

/** Plataforma nav — sidebar (Más sheet). Desktop + overflow destinations. */
export const NAV_MAIN_ITEMS: NavItemDefinition[] = [
  {
    title: 'Inicio',
    url: '/dashboard',
    icon: Home,
  },
  {
    title: 'Tickets',
    url: '/tickets',
    icon: Ticket,
    requiredPermission: PERMISSIONS.tickets.read,
  },
  {
    title: 'Cobranza',
    url: '/cobranza',
    icon: Banknote,
    requiredPermission: PERMISSIONS.tickets.read,
  },
  {
    title: 'Presupuestos',
    url: '/presupuestos',
    icon: ClipboardList,
    requiredPermission: PERMISSIONS.tickets.read,
  },
  {
    title: 'Recordatorios de servicio',
    url: '/service-schedules',
    icon: CalendarClock,
    requiredPermission: SERVICE_SCHEDULES_READ_PERMISSION,
  },
  {
    title: 'Servicios',
    url: '/services',
    icon: Package,
    requiredPermission: PERMISSIONS.services.read,
  },
  {
    title: 'Clientes',
    url: '/clients',
    icon: User,
    requiredPermission: PERMISSIONS.clients.read,
  },
  {
    title: 'Mi empresa',
    url: COMPANY_HUB_PATH,
    icon: Building,
    requiredPermission: PERMISSIONS.company.manage,
    items: [
      {
        title: 'Datos',
        url: COMPANY_HUB_PATH,
        requiredPermission: PERMISSIONS.company.manage,
      },
      {
        title: 'Equipo',
        url: COMPANY_HUB_TEAM_PATH,
        requiredPermission: PERMISSIONS.users.read,
      },
      {
        title: 'Roles',
        url: COMPANY_HUB_ROLES_PATH,
        requiredPermission: PERMISSIONS.roles.read,
      },
    ],
  },
  {
    title: 'Captura rápida',
    url: '/anotar',
    icon: PenLine,
    requiredPermission: PERMISSIONS.tickets.write,
    mobileOnly: true,
  },
];

/**
 * Mobile bottom tabs: Hoy · Tickets · Clientes (+ the create slot and Más in the dock).
 * Defined separately from sidebar so labels/routes can differ (Inicio vs Hoy).
 * Anotar is no longer a tab; it lives on as Captura rápida (create menu, Hoy, Más sheet).
 */
export const MOBILE_TAB_ITEMS: NavItemDefinition[] = [
  {
    title: 'Hoy',
    url: '/dashboard',
    icon: Home,
  },
  {
    title: 'Tickets',
    url: '/tickets',
    icon: Ticket,
    requiredPermission: PERMISSIONS.tickets.read,
  },
  {
    title: 'Clientes',
    url: '/clients',
    icon: User,
    requiredPermission: PERMISSIONS.clients.read,
  },
];

/** Dock column of the center + (between Tickets and Clientes); tabs skip it. */
export const MOBILE_DOCK_CREATE_SLOT = 2;

export type MobileCreateAction = {
  title: string;
  hint: string;
  url: string;
  icon: LucideIcon;
  requiredPermission: string;
};

/** Quick-create menu behind the dock +. */
export const MOBILE_CREATE_ACTIONS: MobileCreateAction[] = [
  {
    title: 'Nuevo ticket',
    hint: 'Cliente, servicios y recibo',
    url: '/tickets/create',
    icon: Ticket,
    requiredPermission: PERMISSIONS.tickets.write,
  },
  {
    title: 'Captura rápida',
    hint: 'Un solo paso, funciona sin señal',
    url: '/anotar',
    icon: PenLine,
    requiredPermission: PERMISSIONS.tickets.write,
  },
  {
    title: 'Nuevo cliente',
    hint: 'Nombre, teléfono y dirección',
    url: '/clients/new',
    icon: UserPlus,
    requiredPermission: PERMISSIONS.clients.write,
  },
];

/**
 * Administración / system nav — sidebar only (Más sheet). System operators only:
 * tenants manage team and roles inside the Mi empresa hub.
 */
export const NAV_SYSTEM_ITEMS: NavItemDefinition[] = [
  {
    title: 'Consola operadora',
    url: '/operator-console',
    icon: Building,
    systemOnly: true,
  },
  {
    title: 'Usuarios',
    url: '/users',
    icon: User,
    requiredPermission: PERMISSIONS.users.read,
    systemOnly: true,
  },
  {
    title: 'Empresas',
    url: '/companies',
    icon: Building,
    requiredPermission: PERMISSIONS.companies.read,
    systemOnly: true,
  },
  {
    title: 'Roles',
    url: '/roles',
    icon: Shield,
    requiredPermission: PERMISSIONS.roles.read,
    systemOnly: true,
  },
  {
    title: 'Catálogo de permisos',
    url: '/permissions',
    icon: Key,
    requiredPermission: PERMISSIONS.permissions.read,
    systemOnly: true,
  },
  {
    title: 'Auditoría',
    url: '/audit',
    icon: ClipboardList,
    systemOnly: true,
  },
  {
    title: 'Papelera',
    url: '/trash',
    icon: Trash2,
    systemOnly: true,
  },
];

/**
 * Administración items a user may see: system-only items for system users,
 * the rest by permission. Tenants get an empty list, so the group is hidden.
 */
export const filterSystemNavItems = (
  items: NavItemDefinition[],
  {
    isSystemUser,
    can,
  }: { isSystemUser: boolean; can: (permission?: string) => boolean },
): NavItemDefinition[] =>
  items.filter((item) =>
    item.systemOnly ? isSystemUser : can(item.requiredPermission),
  );

export const getLongestMatchingHref = (
  pathname: string,
  hrefs: string[],
): string | null => {
  const matching = hrefs.filter(
    (href) => pathname === href || pathname.startsWith(`${href}/`),
  );
  if (matching.length === 0) {
    return null;
  }
  return matching.reduce((a, b) => (a.length >= b.length ? a : b));
};

/**
 * Active tab for the mobile bottom bar.
 * Tickets activates on `/tickets` and everything under it (create, detail, services).
 * Routes outside the tabs (e.g. `/anotar`, `/cobranza`) return null, which lights Más.
 */
export const getActiveMobileTabHref = (
  pathname: string,
  tabs: Array<{ url: string }> = MOBILE_TAB_ITEMS,
): string | null => getLongestMatchingHref(
  pathname,
  tabs.map((item) => item.url),
);
