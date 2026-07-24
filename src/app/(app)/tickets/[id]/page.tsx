import { getTicketById, getTicketAuditHistory } from '@/actions/tickets';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { notFound } from 'next/navigation';
import { buildTicketPdfFileName } from '@/lib/ticket-pdf-data';
import { requirePagePermission } from '@/lib/page-authz';
import {
  TripledDashboardShell,
  TripledMobileAppBar,
} from '@/components/tripled';
import { TicketDetailHeader } from '@/components/tickets/detail/ticket-detail-header';
import { TicketDetailQuickActions } from '@/components/tickets/detail/ticket-detail-quick-actions';
import { TicketDetailCustomerSection } from '@/components/tickets/detail/ticket-detail-customer-section';
import { TicketDetailServicesSection } from '@/components/tickets/detail/ticket-detail-services-section';
import { TicketDetailPaymentsSection } from '@/components/tickets/detail/ticket-detail-payments-section';
import { TicketDetailInvoiceSection } from '@/components/tickets/detail/ticket-detail-invoice-section';
import { TicketDetailMetaSummary } from '@/components/tickets/detail/ticket-detail-meta-summary';
import { TicketDetailTimeline } from '@/components/tickets/detail/ticket-detail-timeline';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function TicketDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePagePermission('tickets.read');
  const { id } = await params;
  const result = await getTicketById(Number(id));

  if (!result.success || !result.data) {
    notFound();
  }

  const ticket = result.data;
  const auditResult = await getTicketAuditHistory(Number(id));
  const auditEntries = auditResult.success ? (auditResult.data ?? []) : [];
  const downloadFileName = buildTicketPdfFileName(ticket);
  const creatorName = ticket.User?.name?.trim() || null;
  const payments = ticket.ticket_payments ?? [];

  return (
    <>
      <header className="hidden h-16 shrink-0 items-center gap-2 border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 md:flex">
        <div className="flex min-w-0 items-center gap-2 px-4">
          <SidebarTrigger className="-ml-1 shrink-0" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <Breadcrumb className="min-w-0">
            <BreadcrumbList>
              <BreadcrumbItem className="hidden md:block">
                <BreadcrumbLink href="/tickets">Tickets</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden md:block" />
              <BreadcrumbItem>
                <BreadcrumbPage className="truncate">
                  Ticket #{String(ticket.id)}
                </BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
      </header>

      <TripledDashboardShell maxWidthClassName="max-w-6xl">
        <TripledMobileAppBar
          title={`Ticket #${ticket.id}`}
          subtitle={ticket.finished ? 'Finalizado' : 'En proceso'}
          backHref="/tickets"
          className="mb-3"
        />

        <div className="flex flex-col gap-6 md:gap-8">
          <TicketDetailHeader
            ticketId={ticket.id}
            clientName={ticket.client_name}
            clientId={ticket.client_id}
            finished={ticket.finished}
            total={ticket.total}
            paid={ticket.paid}
            ticketDate={ticket.ticket_date}
            createdAt={ticket.created_at}
            updatedAt={ticket.updated_at}
            creatorName={creatorName}
          />

          <TicketDetailQuickActions
            ticketId={ticket.id}
            finished={ticket.finished}
            total={ticket.total}
            paid={ticket.paid}
            downloadFileName={downloadFileName}
          />

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(260px,320px)] lg:items-start lg:gap-8">
            <div className="flex min-w-0 flex-col gap-6 md:gap-8">
              <TicketDetailCustomerSection
                clientId={ticket.client_id}
                clientName={ticket.client_name}
                clientTel={ticket.client_tel}
                email={ticket.email}
                document={ticket.document}
              />

              <TicketDetailServicesSection
                ticketId={ticket.id}
                finished={ticket.finished}
                total={ticket.total}
                services={ticket.services_tickets}
              />

              <TicketDetailPaymentsSection
                ticketId={Number(ticket.id)}
                total={ticket.total}
                paid={ticket.paid}
                finished={ticket.finished}
                payments={payments}
              />

              <TicketDetailInvoiceSection
                ticketId={ticket.id}
                finished={ticket.finished}
                total={ticket.total}
                paid={ticket.paid}
                downloadFileName={downloadFileName}
              />

              <div className="lg:hidden">
                <TicketDetailTimeline entries={auditEntries} />
              </div>
            </div>

            <aside className="flex min-w-0 flex-col gap-6 lg:sticky lg:top-20">
              <TicketDetailMetaSummary
                finished={ticket.finished}
                total={ticket.total}
                paid={ticket.paid}
                ticketDate={ticket.ticket_date}
                createdAt={ticket.created_at}
                updatedAt={ticket.updated_at}
                creatorName={creatorName}
                serviceCount={ticket.services_tickets.length}
                paymentCount={payments.length}
              />
              <div className="hidden lg:block">
                <TicketDetailTimeline entries={auditEntries} />
              </div>
            </aside>
          </div>
        </div>
      </TripledDashboardShell>
    </>
  );
}
