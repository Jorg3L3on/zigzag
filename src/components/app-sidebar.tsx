'use client';

import * as React from 'react';
import { GalleryVerticalEnd, Home, Package, Ticket, User } from 'lucide-react';
import { usePathname } from 'next/navigation';

import { NavMain } from '@/components/nav-main';
import { NavUser } from '@/components/nav-user';
import { TeamSwitcher } from '@/components/team-switcher';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from '@/components/ui/sidebar';

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
};

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname();
  const [companies, setCompanies] = React.useState<Company[]>([]);

  React.useEffect(() => {
    const fetchCompanies = async () => {
      try {
        const response = await fetch('/api/companies');
        if (!response.ok) throw new Error('Failed to fetch companies');
        const data = await response.json();
        setCompanies(data);
      } catch (error) {
        console.error('Error fetching companies:', error);
      }
    };

    fetchCompanies();
  }, []);

  const teams = React.useMemo(() => {
    const mappedTeams = companies.map((company) => ({
      id: company.id,
      name: company.name,
      logo: company.logo
        ? () => (
            <img src={company.logo!} alt={company.name} className="size-4" />
          )
        : GalleryVerticalEnd,
      plan: 'Enterprise',
      is_system: company.is_system,
    }));
    return mappedTeams;
  }, [companies]);

  const navItems = React.useMemo(() => {
    return data.navMain.map((item) => ({
      ...item,
      isActive: pathname.startsWith(item.url),
    }));
  }, [pathname]);

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <TeamSwitcher teams={teams} />
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={navItems} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
