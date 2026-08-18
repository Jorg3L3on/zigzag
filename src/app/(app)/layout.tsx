import { AppMobileChrome } from '@/components/app-mobile-chrome';
import { AppSidebar } from '@/components/app-sidebar';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { PermissionsProvider } from '@/contexts/permissions-context';
import { getSessionPermissionMap } from '@/actions/authz';
import { getExpiredLoginPath } from '@/lib/login-redirect';
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
  } catch {
    redirect(getExpiredLoginPath());
  }

  const initialPermissionMap = await getSessionPermissionMap();

  return (
    <PermissionsProvider initialPermissionMap={initialPermissionMap}>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset className="bg-gradient-to-b from-background to-muted/20">
          <AppMobileChrome>{children}</AppMobileChrome>
        </SidebarInset>
      </SidebarProvider>
    </PermissionsProvider>
  );
}
