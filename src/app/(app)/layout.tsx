import { AppSidebar } from '@/components/app-sidebar';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
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
    redirect('/login');
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="bg-gradient-to-b from-background to-muted/20">
        {children}
      </SidebarInset>
    </SidebarProvider>
  );
}
