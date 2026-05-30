'use client';

import * as React from 'react';
import {
  Building,
  GalleryVerticalEnd,
  Shield,
  Home,
  Package,
  Ticket,
  User,
  Key,
  CalendarClock,
  type LucideIcon,
} from 'lucide-react';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { toast } from 'sonner';
import { resolveCompanyLogoUrl } from '@/lib/company-logo-storage';

import { NavMain } from '@/components/nav-main';
import { NavProject } from '@/components/nav-project';
import { NavUser } from '@/components/nav-user';
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
import { PERMISSIONS } from '@/lib/permissions';
import { SERVICE_SCHEDULES_READ_PERMISSION } from '@/lib/service-schedules-rbac';
import { usePermissions } from '@/hooks/use-permissions';

interface Company {
  id: number;
  name: string;
  logo: string | null;
  is_system: boolean;
}

type SidebarItem = {
  title: string;
  url: string;
  icon?: LucideIcon;
  requiredPermission?: string;
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
      url: '/dashboard/tickets',
      icon: Ticket,
      requiredPermission: PERMISSIONS.tickets.read,
    },
    {
      title: 'Recordatorios de servicio',
      url: '/dashboard/service-schedules',
      icon: CalendarClock,
      requiredPermission: SERVICE_SCHEDULES_READ_PERMISSION,
    },
    {
      title: 'Servicios',
      url: '/dashboard/services',
      icon: Package,
      requiredPermission: PERMISSIONS.services.read,
    },
    {
      title: 'Clientes',
      url: '/dashboard/clients',
      icon: User,
      requiredPermission: PERMISSIONS.clients.read,
    },
  ],
  system: [
    {
      title: 'Usuarios',
      url: '/dashboard/users',
      icon: User,
      requiredPermission: PERMISSIONS.users.read,
    },
    {
      title: 'Empresas',
      url: '/dashboard/companies',
      icon: Building,
      requiredPermission: PERMISSIONS.companies.read,
    },
    {
      title: 'Roles',
      url: '/dashboard/roles',
      icon: Shield,
      requiredPermission: PERMISSIONS.roles.read,
    },
    {
      title: 'Permisos',
      url: '/dashboard/permissions',
      icon: Key,
      requiredPermission: PERMISSIONS.permissions.read,
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
  const [companies, setCompanies] = React.useState<Company[]>([]);

  React.useEffect(() => {
    const fetchCompanies = async () => {
      try {
        const response = await fetch('/api/companies');
        // During sign-out/session expiry we can receive non-200 responses.
        // Keep sidebar stable instead of logging noisy runtime errors.
        if (!response.ok) {
          setCompanies([]);
          const payload = await response.json().catch(() => null);
          const errorType = classifyClientError(
            null,
            response.status,
            payload?.errorType,
          );
          toast.error(
            getErrorMessageByType(
              errorType,
              payload?.error || 'No se pudieron cargar las empresas',
            ),
          );
          return;
        }
        const payload = await response.json();
        if (payload?.success) {
          setCompanies(payload.data ?? []);
          return;
        }

        const errorType = classifyClientError(
          null,
          response.status,
          payload?.errorType,
        );
        setCompanies([]);
        toast.error(
          getErrorMessageByType(
            errorType,
            payload?.error || 'No se pudieron cargar las empresas',
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

  const visibleSystem = React.useMemo(
    () => data.system.filter((item) => canAccess(item.requiredPermission)),
    [canAccess],
  );

  const teams = React.useMemo(() => {
    const mappedTeams = companies.map((company) => {
      const logoUrl = resolveCompanyLogoUrl(company.logo);

      return {
        id: company.id,
        name: company.name,
        logo: logoUrl
          ? () => (
              <Image
                src={logoUrl}
                alt={company.name}
                width={24}
                height={24}
                className="size-6 rounded-sm object-contain"
              />
            )
          : GalleryVerticalEnd,
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
        <TripledMotionDiv variants={tripledFadeInUp} initial="hidden" animate="visible">
          <NavMain items={navItems} />
          {(isSystemCompany || systemItems.length > 0) && (
            <NavProject items={systemItems} />
          )}
        </TripledMotionDiv>
      </SidebarContent>
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
