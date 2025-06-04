import { AppSidebar } from '@/components/app-sidebar';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar';

export default function Page() {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 h-4" />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem className="hidden md:block">
                  <BreadcrumbLink href="#">
                    Building Your Application
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden md:block" />
                <BreadcrumbItem>
                  <BreadcrumbPage>Data Fetching</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
        </header>
        <div className="flex flex-1 flex-col gap-6 p-6">
          <div className="grid gap-6 md:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle>Overview</CardTitle>
                <CardDescription>
                  View your application statistics
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="aspect-video rounded-lg bg-muted/50" />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Analytics</CardTitle>
                <CardDescription>
                  Track your application performance
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="aspect-video rounded-lg bg-muted/50" />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Reports</CardTitle>
                <CardDescription>
                  View detailed reports and insights
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="aspect-video rounded-lg bg-muted/50" />
              </CardContent>
            </Card>
          </div>
          <Card className="flex-1">
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>
                Monitor your application&apos;s recent events
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[400px] rounded-lg bg-muted/50" />
            </CardContent>
          </Card>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
