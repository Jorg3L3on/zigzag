import {
  Banknote,
  Building,
  CalendarClock,
  ClipboardList,
  Home,
  Key,
  Package,
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
  /** When true, item is a primary mobile bottom-tab destination. */
  mobileTab?: boolean;
  items?: {
    title: string;
    url: string;
    requiredPermission?: string;
  }[];
};

/** Plataforma nav — shared by AppSidebar and mobile bottom tabs. */
export const NAV_MAIN_ITEMS: NavItemDefinition[] = [
  {
    title: 'Inicio',
    url: '/dashboard',
    icon: Home,
    mobileTab: true,
  },
  {
    title: 'Tickets',
    url: '/tickets',
    icon: Ticket,
    requiredPermission: PERMISSIONS.tickets.read,
    mobileTab: true,
  },
  {
    title: 'Cobranza',
    url: '/cobranza',
    icon: Banknote,
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
    mobileTab: true,
  },
  {
    title: 'Mi empresa',
    url: '/company',
    icon: Building,
    requiredPermission: PERMISSIONS.company.manage,
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

export const MOBILE_TAB_ITEMS = NAV_MAIN_ITEMS.filter((item) => item.mobileTab);

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

/** Fixed height of the mobile bottom tab row (excluding safe-area). */
export const MOBILE_BOTTOM_TAB_BAR_HEIGHT_PX = 56;
