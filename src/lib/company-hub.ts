import { PERMISSIONS } from '@/lib/permissions';

export type CompanyHubTabKey = 'datos' | 'equipo' | 'roles';

export type CompanyHubTab = {
  key: CompanyHubTabKey;
  label: string;
  href: string;
  requiredPermission: string;
};

export const COMPANY_HUB_PATH = '/company';
export const COMPANY_HUB_TEAM_PATH = '/company/equipo';
export const COMPANY_HUB_ROLES_PATH = '/company/roles';

/** Mi empresa hub tabs, in display order (ZIG-I3). */
export const COMPANY_HUB_TABS: CompanyHubTab[] = [
  {
    key: 'datos',
    label: 'Datos',
    href: COMPANY_HUB_PATH,
    requiredPermission: PERMISSIONS.company.manage,
  },
  {
    key: 'equipo',
    label: 'Equipo',
    href: COMPANY_HUB_TEAM_PATH,
    requiredPermission: PERMISSIONS.users.read,
  },
  {
    key: 'roles',
    label: 'Roles',
    href: COMPANY_HUB_ROLES_PATH,
    requiredPermission: PERMISSIONS.roles.read,
  },
];

const isAtOrUnder = (pathname: string, href: string) =>
  pathname === href || pathname.startsWith(`${href}/`);

/** `/company` exact is Datos; nested hub routes resolve to their own tab. */
export const getActiveCompanyHubTab = (
  pathname: string,
): CompanyHubTabKey | null => {
  if (isAtOrUnder(pathname, COMPANY_HUB_TEAM_PATH)) {
    return 'equipo';
  }
  if (isAtOrUnder(pathname, COMPANY_HUB_ROLES_PATH)) {
    return 'roles';
  }
  if (pathname === COMPANY_HUB_PATH) {
    return 'datos';
  }
  return null;
};

export const getCompanyHubTabLabel = (pathname: string): string | null => {
  const key = getActiveCompanyHubTab(pathname);
  return COMPANY_HUB_TABS.find((tab) => tab.key === key)?.label ?? null;
};

/** Full-screen sub-pages of the hub (mobile app bar with back instead of tabs). */
export const getCompanyHubSubpage = (
  pathname: string,
): { title: string; backHref: string; backLabel: string } | null => {
  if (pathname === `${COMPANY_HUB_ROLES_PATH}/nuevo`) {
    return { title: 'Nuevo rol', backHref: COMPANY_HUB_ROLES_PATH, backLabel: 'Volver a roles' };
  }
  if (/^\/company\/roles\/\d+$/.test(pathname)) {
    return { title: 'Editar rol', backHref: COMPANY_HUB_ROLES_PATH, backLabel: 'Volver a roles' };
  }
  return null;
};
