import { AppMobileChrome } from '@/components/app-mobile-chrome';
import { AppSidebar } from '@/components/app-sidebar';
import { AppBadgeSync } from '@/components/notifications/app-badge-sync';
import { NotificationReadFromUrl } from '@/components/notifications/notification-read-from-url';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { PermissionsProvider } from '@/contexts/permissions-context';
import { CompanyProvider } from '@/contexts/company-context';
import { getSessionPermissionMap } from '@/actions/authz';
import { CHANGE_PASSWORD_PATH } from '@/lib/password-change';
import { getExpiredLoginPath } from '@/lib/login-redirect';
import { PasswordChangeRequiredError } from '@/lib/errors';
import { requireActionAuth } from '@/lib/security';
import { isSidebarOpenFromCookie, SIDEBAR_COOKIE_NAME } from '@/lib/sidebar-state';
import {
  parseSelectedCompanyCookie,
  SELECTED_COMPANY_COOKIE_NAME,
} from '@/lib/selected-company-cookie';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  try {
    await requireActionAuth();
  } catch (error) {
    if (error instanceof PasswordChangeRequiredError) {
      redirect(CHANGE_PASSWORD_PATH);
    }
    redirect(getExpiredLoginPath());
  }

  const initialPermissionMap = await getSessionPermissionMap();
  const cookieStore = await cookies();
  // The collapsed sidebar survives a reload (ZIG-I26-3).
  const sidebarOpen = isSidebarOpenFromCookie(cookieStore.get(SIDEBAR_COOKIE_NAME)?.value);
  // The system user's chosen company seeds the picker so SSR matches the
  // client (ZIG-I37-5). Read here, not in the root layout, so pages outside
  // (app) (/login, /offline, legal pages) stay static. UI preference only:
  // never used to authorize; actions validate the tenant themselves.
  const initialCompany = parseSelectedCompanyCookie(
    cookieStore.get(SELECTED_COMPANY_COOKIE_NAME)?.value,
  );

  return (
    <CompanyProvider initialCompany={initialCompany}>
      <PermissionsProvider initialPermissionMap={initialPermissionMap}>
        <SidebarProvider defaultOpen={sidebarOpen}>
          <a
            href="#contenido"
            className="sr-only focus-visible:not-sr-only focus-visible:fixed focus-visible:left-3 focus-visible:top-3 focus-visible:z-[100] focus-visible:inline-flex focus-visible:min-h-11 focus-visible:items-center focus-visible:rounded-lg focus-visible:bg-background focus-visible:px-4 focus-visible:text-sm focus-visible:font-semibold focus-visible:text-primary focus-visible:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Saltar al contenido
          </a>
          <NotificationReadFromUrl />
          <AppBadgeSync />
          <AppSidebar />
          <SidebarInset
            id="contenido"
            tabIndex={-1}
            className="bg-gradient-to-b from-background to-muted/20 outline-none"
          >
            <AppMobileChrome>{children}</AppMobileChrome>
          </SidebarInset>
        </SidebarProvider>
      </PermissionsProvider>
    </CompanyProvider>
  );
}
