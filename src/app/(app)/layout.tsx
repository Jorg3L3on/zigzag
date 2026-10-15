import { AppMobileChrome } from '@/components/app-mobile-chrome';
import { AppSidebar } from '@/components/app-sidebar';
import { AppBadgeSync } from '@/components/notifications/app-badge-sync';
import { NotificationReadFromUrl } from '@/components/notifications/notification-read-from-url';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { PermissionsProvider } from '@/contexts/permissions-context';
import { getSessionPermissionMap } from '@/actions/authz';
import { CHANGE_PASSWORD_PATH } from '@/lib/password-change';
import { getExpiredLoginPath } from '@/lib/login-redirect';
import { PasswordChangeRequiredError } from '@/lib/errors';
import { requireActionAuth } from '@/lib/security';
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

  return (
    <PermissionsProvider initialPermissionMap={initialPermissionMap}>
      <SidebarProvider>
        <NotificationReadFromUrl />
        <AppBadgeSync />
        <AppSidebar />
        <SidebarInset className="bg-gradient-to-b from-background to-muted/20">
          <AppMobileChrome>{children}</AppMobileChrome>
        </SidebarInset>
      </SidebarProvider>
    </PermissionsProvider>
  );
}
