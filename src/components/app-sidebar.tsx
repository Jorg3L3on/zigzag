'use client';

import * as React from 'react';
import {
  Building,
  Shield,
  Home,
  Package,
  Ticket,
  User,
  Key,
  CalendarClock,
  ClipboardList,
  Trash2,
  type LucideIcon,
} from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { toast } from 'sonner';
import { CompanyBrandAvatar } from '@/components/companies/company-brand-avatar';
import { resolveCompanyLogoUrl } from '@/lib/company-logo-storage';

import { NavMain } from '@/components/nav-main';
import { NavProject } from '@/components/nav-project';
import { NavUser } from '@/components/nav-user';
import { NotificationBell } from '@/components/notifications/notification-bell';
import { GlobalSearch } from '@/components/search/global-search';
import { TeamSwitcher } from '@/components/team-switcher';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from '@/components/ui/sidebar';
import { TripledMotionDiv, tripledFadeInUp } from '@/components/tripled';
import { classifyClientError, getErrorMessageByType } from '@/lib/network-awareness';
import { getCompanies } from '@/actions/companies';
import type { Company as CompanyRow } from '@/db/schema';
import { PERMISSIONS } from '@/lib/permissions';
import { SERVICE_SCHEDULES_READ_PERMISSION } from '@/lib/service-schedules-rbac';
import { usePermissions } from '@/hooks/use-permissions';


type SidebarItem = {
  title: string;
  url: string;
  icon?: LucideIcon;
  requiredPermission?: string;
  systemOnly?: boolean;
  items?: {
    title: string;
    url: string;
    requiredPermission?: string;
  }[];
};

const data: { navMain: SidebarItem[]; system: SidebarItem[] } = {
  navMain: [
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
    {
      title: 'Papelera',
      url: '/trash',
      icon: Trash2,
    },
  ],
  system: [
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
  ],
};

const getLongestMatchingHref = (pathname: string, hrefs: string[]): string | null => {
  const matching = hrefs.filter((h) => pathname === h || pathname.startsWith(`${h}/`));
  if (matching.length === 0) {
    return null;
  }
  return matching.reduce((a, b) => (a.length >= b.length ? a : b));
};

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const { can } = usePermissions();
  const [companies, setCompanies] = React.useState<CompanyRow[]>([]);

  React.useEffect(() => {
    const fetchCompanies = async () => {
      try {
        const result = await getCompanies();
        if (result.success) {
          setCompanies(result.data ?? []);
          return;
        }

        setCompanies([]);
        const errorType = classifyClientError(null, undefined, result.errorType);
        toast.error(
          getErrorMessageByType(
            errorType,
            result.error || 'No se pudieron cargar las empresas',
          ),
        );
      } catch (error) {
        console.error('Error fetching companies:', error);
        const errorType = classifyClientError(error);
        toast.error(
          getErrorMessageByType(errorType, 'No se pudieron cargar las empresas'),
        );
      }
    };

    fetchCompanies();
  }, []);

  const canAccess = React.useCallback(
    (requiredPermission?: string) => can(requiredPermission),
    [can],
  );

  const visibleNavMain = React.useMemo(
    () =>
      data.navMain
        .map((item) => ({
          ...item,
          items: item.items?.filter((sub) => canAccess(sub.requiredPermission)),
        }))
        .filter(
          (item) =>
            canAccess(item.requiredPermission) || Boolean(item.items?.length),
        ),
    [canAccess],
  );

  const visibleSystem = React.useMemo(() => {
    const isSystemUser = session?.user?.company_is_system ?? false;
    if (!isSystemUser) {
      return [];
    }
    return data.system.filter((item) => {
      if (item.systemOnly) {
        return isSystemUser;
      }
      return canAccess(item.requiredPermission);
    });
  }, [canAccess, session?.user?.company_is_system]);

  const teams = React.useMemo(() => {
    const mappedTeams = companies.map((company) => {
      const logoUrl = resolveCompanyLogoUrl(company.logo);

      return {
        id: company.id,
        name: company.name,
        logoUrl,
        logo: () => (
          <CompanyBrandAvatar name={company.name} logoUrl={company.logo} />
        ),
        plan: 'Enterprise',
        is_system: company.is_system,
      };
    });
    return mappedTeams;
  }, [companies]);

  const allSidebarHrefs = React.useMemo(
    () => [
      ...data.navMain.flatMap((item) => [
        item.url,
        ...(item.items?.map((s) => s.url) ?? []),
      ]),
      ...data.system.map((s) => s.url),
    ],
    [],
  );

  const globalLongest = React.useMemo(
    () => getLongestMatchingHref(pathname, allSidebarHrefs),
    [pathname, allSidebarHrefs],
  );

  const navItems = React.useMemo(() => {
    return visibleNavMain.map((item) => {
      if (item.items) {
        const groupLongest = getLongestMatchingHref(
          pathname,
          item.items.map((s) => s.url),
        );
        return {
          ...item,
          isActive: groupLongest !== null,
          items: item.items.map((sub) => ({
            ...sub,
            isActive: groupLongest === sub.url,
          })),
        };
      }
      return {
        ...item,
        isActive: globalLongest === item.url,
      };
    });
  }, [pathname, globalLongest, visibleNavMain]);

  const systemItems = React.useMemo(() => {
    return visibleSystem.map((item) => ({
      ...item,
      isActive: globalLongest === item.url,
    }));
  }, [globalLongest, visibleSystem]);

  const isSystemCompany = session?.user?.company_is_system;

  return (
    <Sidebar collapsible="icon" {...props} className="border-r border-border/50">
      <SidebarHeader className="bg-gradient-to-r from-primary/5 to-transparent">
        <TeamSwitcher teams={teams} />
      </SidebarHeader>
      <SidebarContent>
        <div className="px-2 pt-2">
          <GlobalSearch />
        </div>
        <TripledMotionDiv variants={tripledFadeInUp} initial="hidden" animate="visible">
          {isSystemCompany && systemItems.length > 0 && (
            <NavProject items={systemItems} />
          )}
          <NavMain items={navItems} />
        </TripledMotionDiv>
      </SidebarContent>
      <SidebarFooter>
        <div className="flex items-center justify-between gap-2 px-1 group-data-[collapsible=icon]:justify-center">
          <span className="truncate text-xs font-medium text-muted-foreground group-data-[collapsible=icon]:hidden">
            Notificaciones
          </span>
          <NotificationBell />
        </div>
        <NavUser />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
