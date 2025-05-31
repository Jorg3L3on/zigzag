'use client';

import * as React from 'react';
import { GalleryVerticalEnd, Home, Package, Ticket } from 'lucide-react';
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

// This is sample data.
const data = {
  user: {
    name: 'shadcn',
    email: 'm@example.com',
    avatar: '/avatars/shadcn.jpg',
  },
  teams: [
    {
      name: 'Acme Inc',
      logo: GalleryVerticalEnd,
      plan: 'Enterprise',
    },
  ],
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
  ],
};

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname();

  const navItems = React.useMemo(() => {
    return data.navMain.map((item) => ({
      ...item,
      isActive: pathname.startsWith(item.url),
    }));
  }, [pathname]);

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <TeamSwitcher teams={data.teams} />
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
