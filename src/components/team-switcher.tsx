'use client';

import * as React from 'react';
import { ChevronsUpDown, Building2 } from 'lucide-react';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';
import { useCompany } from '@/contexts/company-context';
import { useSession } from 'next-auth/react';

interface Team {
  id: number;
  name: string;
  logo: React.ElementType;
  logoUrl: string | null;
  plan: string;
  is_system: boolean;
}

export function TeamSwitcher({ teams }: { teams: Team[] }) {
  const { data: session } = useSession();
  const { isMobile } = useSidebar();
  const { selectedCompany, setSelectedCompany } = useCompany();

  React.useEffect(() => {
    // Reset selected company when session changes
    if (session?.user?.company_id) {
      const userCompany = teams.find(
        (team) => team.id === session.user.company_id,
      );
      if (userCompany) {
        setSelectedCompany(userCompany);
      } else {
        setSelectedCompany(teams[0]);
      }
    } else if (teams.length > 0) {
      setSelectedCompany(teams[0]);
    }
  }, [teams, session?.user?.company_id, setSelectedCompany]);

  const handleCompanySelect = React.useCallback(
    (team: Team) => {
      setSelectedCompany(team);
    },
    [setSelectedCompany],
  );

  if (!teams.length) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton size="lg" disabled>
            <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
              <Building2 className="size-4" />
            </div>
            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-semibold">Ninguna empresa</span>
              <span className="truncate text-xs">Cargando...</span>
            </div>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    );
  }

  if (!selectedCompany) {
    return null;
  }

  const isSystemUser = session?.user?.company_is_system ?? false;
  const userCompany = teams.find(
    (team) => team.id === session?.user?.company_id,
  );
  const displayTeams = isSystemUser ? teams : userCompany ? [userCompany] : [];

  const companyBrandContent = (
    <>
      <div className="flex aspect-square size-8 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-sidebar-border/60 bg-background shadow-sm">
        <selectedCompany.logo className="size-8 rounded-lg" />
      </div>
      <div className="grid min-w-0 flex-1 text-left text-sm leading-tight">
        <span className="truncate font-semibold text-sidebar-foreground">
          {selectedCompany.name}
        </span>
        <span className="truncate text-xs text-muted-foreground">
          {selectedCompany.is_system ? 'Admin' : 'Empresa'}
        </span>
      </div>
      {isSystemUser && (
        <ChevronsUpDown className="ml-auto size-4 shrink-0 text-muted-foreground" />
      )}
    </>
  );

  if (!isSystemUser) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <div
            className="flex h-12 w-full items-center gap-2 overflow-hidden rounded-md p-2 text-sm group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:p-2"
            aria-label={`Empresa: ${selectedCompany.name}`}
          >
            {companyBrandContent}
          </div>
        </SidebarMenuItem>
      </SidebarMenu>
    );
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              {companyBrandContent}
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
            align="start"
            side={isMobile ? 'bottom' : 'right'}
            sideOffset={4}
          >
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              Empresas
            </DropdownMenuLabel>
            {displayTeams.map((team) => (
              <DropdownMenuItem
                key={team.id}
                onClick={() => handleCompanySelect(team)}
                className="gap-2 p-2"
              >
                <div className="flex size-6 items-center justify-center overflow-hidden rounded-sm border">
                  <team.logo className="size-6 shrink-0 rounded-sm" />
                </div>
                {team.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
