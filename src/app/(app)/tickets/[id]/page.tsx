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
import { TicketDetailPrimaryActions } from '@/components/tickets/detail/ticket-detail-primary-actions';
import { TicketDetailFinishPanel } from '@/components/tickets/detail/ticket-detail-finish-panel';
import { TicketDetailCustomerSection } from '@/components/tickets/detail/ticket-detail-customer-section';
import { TicketDetailServicesSection } from '@/components/tickets/detail/ticket-detail-services-section';
import { TicketDetailPaymentsSection } from '@/components/tickets/detail/ticket-detail-payments-section';
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

  const serviceLines = (() => {
    const byService = new Map<number, string>();
    for (const line of ticket.services_tickets) {
      byService.set(line.service_id, line.service?.name ?? 'Servicio');
    }
    return Array.from(byService.entries()).map(([serviceId, serviceName]) => ({
      serviceId,
      serviceName,
    }));
  })();

  const primaryActionProps = {
    ticketId: ticket.id,
    clientId: ticket.client_id,
    finished: ticket.finished,
    total: ticket.total,
    paid: ticket.paid,
    downloadFileName,
  };

  const showSticky = true;

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

      <TripledDashboardShell
        maxWidthClassName="max-w-6xl"
        hasMobileStickyAction={showSticky}
      >
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
            actions={
              <TicketDetailPrimaryActions
                {...primaryActionProps}
                placement="desktop"
              />
            }
          />

          <TicketDetailPrimaryActions
            {...primaryActionProps}
            placement="mobile-sticky"
          />

          {!ticket.finished ? (
            <TicketDetailFinishPanel
              ticketId={ticket.id}
              clientId={ticket.client_id}
              clientName={ticket.client_name}
              total={ticket.total}
              ticketDate={ticket.ticket_date}
              serviceLines={serviceLines}
              downloadFileName={downloadFileName}
            />
          ) : null}

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(260px,320px)] lg:items-start lg:gap-8">
            <div className="flex min-w-0 flex-col gap-6 md:gap-8">
              <TicketDetailCustomerSection
                clientId={ticket.client_id}
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

              <div className="lg:hidden">
                <TicketDetailTimeline entries={auditEntries} />
              </div>
            </div>

            <aside className="hidden min-w-0 flex-col gap-6 lg:sticky lg:top-20 lg:flex">
              <TicketDetailTimeline entries={auditEntries} />
            </aside>
          </div>
        </div>
      </TripledDashboardShell>
    </>
  );
}
