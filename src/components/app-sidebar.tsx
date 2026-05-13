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
} from 'lucide-react';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { toast } from 'sonner';

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

interface Company {
  id: number;
  name: string;
  logo: string | null;
  is_system: boolean;
}

// This is sample data.
const data = {
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
      items: [
        {
          title: 'Ver tickets',
          url: '/dashboard/tickets',
        },
        {
          title: 'Crear ticket',
          url: '/dashboard/tickets/create',
        },
      ],
    },
    {
      title: 'Servicios',
      url: '/dashboard/services',
      icon: Package,
      items: [
        {
          title: 'Ver servicios',
          url: '/dashboard/services',
        },
        {
          title: 'Crear servicio',
          url: '/dashboard/services/new',
        },
      ],
    },
    {
      title: 'Clientes',
      url: '/dashboard/clients',
      icon: User,
      items: [
        {
          title: 'Ver clientes',
          url: '/dashboard/clients',
        },
        {
          title: 'Crear cliente',
          url: '/dashboard/clients/new',
        },
      ],
    },
  ],
  system: [
    {
      title: 'Usuarios',
      url: '/dashboard/users',
      icon: User,
    },
    {
      title: 'Empresas',
      url: '/dashboard/companies',
      icon: Building,
    },
    {
      title: 'Roles',
      url: '/dashboard/roles',
      icon: Shield,
    },
    {
      title: 'Permisos',
      url: '/dashboard/permissions',
      icon: Key,
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

  const teams = React.useMemo(() => {
    const mappedTeams = companies.map((company) => {
      const logoUrl = company.logo;

      return {
        id: company.id,
        name: company.name,
        logo: logoUrl
          ? () => (
              <Image
                src={logoUrl}
                alt={company.name}
                width={16}
                height={16}
                className="size-4 rounded-sm object-cover"
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
    return data.navMain.map((item) => {
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
  }, [pathname, globalLongest]);

  const systemItems = React.useMemo(() => {
    return data.system.map((item) => ({
      ...item,
      isActive: globalLongest === item.url,
    }));
  }, [globalLongest]);

  const isSystemCompany = session?.user?.company_is_system;

  return (
    <Sidebar collapsible="icon" {...props} className="border-r border-border/50">
      <SidebarHeader className="bg-gradient-to-r from-primary/5 to-transparent">
        <TeamSwitcher teams={teams} />
      </SidebarHeader>
      <SidebarContent>
        <TripledMotionDiv variants={tripledFadeInUp} initial="hidden" animate="visible">
          <NavMain items={navItems} />
          {isSystemCompany && <NavProject items={systemItems} />}
        </TripledMotionDiv>
      </SidebarContent>
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
