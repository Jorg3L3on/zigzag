'use client';

import * as React from 'react';
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
import { getCompanies, getOwnCompany } from '@/actions/companies';
import {
  companyBrandFromSession,
  resolveSidebarCompanyLoadMode,
  type SidebarCompanyBrand,
} from '@/lib/sidebar-company-brand';
import { PERMISSIONS } from '@/lib/permissions';
import {
  getLongestMatchingHref,
  NAV_MAIN_ITEMS,
  NAV_SYSTEM_ITEMS,
} from '@/lib/nav-items';
import { usePermissions } from '@/hooks/use-permissions';

const data = {
  navMain: NAV_MAIN_ITEMS,
  system: NAV_SYSTEM_ITEMS,
};

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const { can, loading: permissionsLoading, isSystem } = usePermissions();
  const [companies, setCompanies] = React.useState<SidebarCompanyBrand[]>([]);

  // Seed brand from the JWT session so tenant users never sit on "Ninguna empresa"
  // while permissions resolve (tenant roles intentionally lack companies.read).
  React.useEffect(() => {
    const brand = companyBrandFromSession(session?.user);
    if (!brand) {
      return;
    }
    setCompanies((prev) => (prev.length > 0 ? prev : [brand]));
  }, [
    session?.user?.company_id,
    session?.user?.company_name,
    session?.user?.company_is_system,
  ]);

  React.useEffect(() => {
    const mode = resolveSidebarCompanyLoadMode({
      permissionsLoading,
      isSystem,
      canReadCompanies: can(PERMISSIONS.companies.read),
      canManageCompany: can(PERMISSIONS.company.manage),
    });

    if (mode === 'wait' || mode === 'session') {
      return;
    }

    let cancelled = false;

    const fetchCompanies = async () => {
      try {
        if (mode === 'list') {
          const result = await getCompanies();
          if (cancelled) {
            return;
          }
          if (result.success) {
            setCompanies(
              (result.data ?? []).map((row) => ({
                id: row.id,
                name: row.name,
                logo: row.logo,
                is_system: row.is_system,
              })),
            );
            return;
          }

          const errorType = classifyClientError(null, undefined, result.errorType);
          toast.error(
            getErrorMessageByType(
              errorType,
              result.error || 'No se pudieron cargar las empresas',
            ),
          );
          return;
        }

        const result = await getOwnCompany();
        if (cancelled) {
          return;
        }
        if (result.success && result.data) {
          setCompanies([
            {
              id: result.data.id,
              name: result.data.name,
              logo: result.data.logo,
              is_system: result.data.is_system,
            },
          ]);
        }
        // Keep session seed on failure — do not toast CO001 for tenant self-load.
      } catch (error) {
        if (cancelled) {
          return;
        }
        console.error('Error fetching companies:', error);
        if (mode === 'list') {
          const errorType = classifyClientError(error);
          toast.error(
            getErrorMessageByType(
              errorType,
              'No se pudieron cargar las empresas',
            ),
          );
        }
      }
    };

    void fetchCompanies();

    return () => {
      cancelled = true;
    };
  }, [permissionsLoading, isSystem, can]);

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
          {systemItems.length > 0 && <NavProject items={systemItems} />}
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
