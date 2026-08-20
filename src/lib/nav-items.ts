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
  type LucideIcon,
} from 'lucide-react';

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
    url: '/company',
    icon: Building,
    requiredPermission: PERMISSIONS.company.manage,
  },
];

/**
 * Field program mobile bottom tabs: Hoy · Anotar · Clientes (+ Más in the tab bar).
 * Defined separately from sidebar so labels/routes can differ (Inicio vs Hoy, Tickets list vs Anotar).
 * Anotar href becomes `/anotar` when job-capture-anotar ships — change only here.
 */
export const MOBILE_TAB_ITEMS: NavItemDefinition[] = [
  {
    title: 'Hoy',
    url: '/dashboard',
    icon: Home,
  },
  {
    title: 'Anotar',
    url: '/tickets/create',
    icon: PenLine,
    requiredPermission: PERMISSIONS.tickets.write,
  },
  {
    title: 'Clientes',
    url: '/clients',
    icon: User,
    requiredPermission: PERMISSIONS.clients.read,
  },
];

/** Administración / system nav — sidebar only (Más sheet). */
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
  },
  {
    title: 'Permisos',
    url: '/permissions',
    icon: Key,
    requiredPermission: PERMISSIONS.permissions.read,
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
 * Active tab for field bottom bar.
 * Hoy must not activate on `/tickets` list alone (Tickets is not a tab).
 * Anotar activates on `/tickets/create` (and nested under create) until `/anotar` ships.
 */
export const getActiveMobileTabHref = (
  pathname: string,
  tabs: Array<{ url: string }> = MOBILE_TAB_ITEMS,
): string | null => getLongestMatchingHref(
  pathname,
  tabs.map((item) => item.url),
);

/** Fixed height of the mobile bottom tab row (excluding safe-area). */
export const MOBILE_BOTTOM_TAB_BAR_HEIGHT_PX = 56;
