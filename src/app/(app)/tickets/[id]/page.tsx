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
import { notFound, redirect } from 'next/navigation';
import { buildTicketPdfFileName } from '@/lib/ticket-pdf-data';
import { requirePagePermission } from '@/lib/page-authz';
import {
  TripledDashboardShell,
  TripledMobileAppBar,
} from '@/components/tripled';
import { TicketDetailHeader } from '@/components/tickets/detail/ticket-detail-header';
import { TicketDetailPrimaryActions } from '@/components/tickets/detail/ticket-detail-primary-actions';
import { TicketDetailFinishPanel } from '@/components/tickets/detail/ticket-detail-finish-panel';
import { TicketDetailActionsMenu } from '@/components/tickets/detail/ticket-detail-actions-menu';
import { TicketCollectProvider } from '@/components/tickets/detail/ticket-detail-collect-context';
import { TicketDetailHero } from '@/components/tickets/detail/ticket-detail-hero';
import { TicketDetailQuickActions } from '@/components/tickets/detail/ticket-detail-quick-actions';
import { TicketDetailStatusPill } from '@/components/tickets/detail/ticket-detail-status-pill';
import { TicketDetailServicesSection } from '@/components/tickets/detail/ticket-detail-services-section';
import { TicketDetailPaymentsSection } from '@/components/tickets/detail/ticket-detail-payments-section';
import { TicketDetailTimeline } from '@/components/tickets/detail/ticket-detail-timeline';
import { getServiceLineName } from '@/lib/service-line-display';
import { isPresupuestoTicket } from '@/lib/ticket-document-kind';

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
  // Quotes have their own pages (ZIG-I5-4); never render one as a work ticket.
  if (isPresupuestoTicket(ticket.document_kind)) {
    redirect(`/presupuestos/${String(ticket.id)}`);
  }
  const auditResult = await getTicketAuditHistory(Number(id));
  const auditEntries = auditResult.success ? (auditResult.data ?? []) : [];
  const downloadFileName = buildTicketPdfFileName(ticket);
  const creatorName = ticket.User?.name?.trim() || null;
  const payments = ticket.ticket_payments ?? [];

  const serviceLines = (() => {
    const byService = new Map<number, string>();
    // Service reminders only apply to catalog lines; inline lines (ZIG-I5) are skipped.
    for (const line of ticket.services_tickets) {
      if (line.service_id == null) continue;
      byService.set(line.service_id, getServiceLineName(line));
    }
    return Array.from(byService.entries()).map(([serviceId, serviceName]) => ({
      serviceId,
      serviceName,
    }));
  })();

  const fromPresupuestoId =
    ticket.converted_from_ticket_id != null ? String(ticket.converted_from_ticket_id) : null;
  const total = ticket.total;
  const paid = ticket.paid;

  const documentProps = {
    ticketId: Number(ticket.id),
    clientName: ticket.client_name,
    clientTel: ticket.client_tel,
    total,
    paid,
    downloadFileName,
  };
  const primaryActionProps = {
    ...documentProps,
    finished: ticket.finished,
    paymentsCount: payments.length,
  };

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

      <TicketCollectProvider
        ticketId={Number(ticket.id)}
        total={total}
        paid={paid}
        companyId={ticket.company_id}
      >
        <TripledDashboardShell maxWidthClassName="max-w-6xl">
          <TripledMobileAppBar
            title={`Ticket #${ticket.id}`}
            backHref="/tickets"
            className="mb-3"
            endSlot={
              <div className="flex shrink-0 items-center">
                <TicketDetailStatusPill finished={ticket.finished} total={total} paid={paid} />
                <TicketDetailActionsMenu
                  ticketId={Number(ticket.id)}
                  clientName={ticket.client_name}
                  clientTel={ticket.client_tel}
                  total={total}
                  paid={paid}
                  paymentsCount={payments.length}
                  downloadFileName={downloadFileName}
                />
              </div>
            }
          />

          <div className="flex flex-col gap-4 md:gap-6">
            <TicketDetailHeader
              ticketId={ticket.id}
              clientName={ticket.client_name}
              clientId={ticket.client_id}
              finished={ticket.finished}
              total={total}
              paid={paid}
              ticketDate={ticket.ticket_date}
              creatorName={creatorName}
              fromPresupuestoId={fromPresupuestoId}
              actions={<TicketDetailPrimaryActions {...primaryActionProps} placement="desktop" />}
            />

            <TicketDetailHero finished={ticket.finished} total={total} paid={paid} />

            <TicketDetailQuickActions
              {...documentProps}
              finished={ticket.finished}
              className="md:max-w-md"
            />

            {!ticket.finished ? (
              <TicketDetailFinishPanel
                ticketId={ticket.id}
                clientId={ticket.client_id}
                clientName={ticket.client_name}
                total={total}
                ticketDate={ticket.ticket_date}
                serviceLines={serviceLines}
                lineCount={ticket.services_tickets.length}
                downloadFileName={downloadFileName}
              />
            ) : null}

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(260px,320px)] lg:items-start lg:gap-8">
              <div className="flex min-w-0 flex-col gap-4 md:gap-6">
                <TicketDetailServicesSection
                  ticketId={ticket.id}
                  total={total}
                  paid={paid}
                  services={ticket.services_tickets}
                />

                {ticket.finished ? <TicketDetailPaymentsSection payments={payments} /> : null}

                <div className="lg:hidden">
                  <TicketDetailTimeline
                    entries={auditEntries}
                    createdAt={ticket.created_at}
                    updatedAt={ticket.updated_at}
                  />
                </div>
              </div>

              <aside className="hidden min-w-0 flex-col gap-6 lg:sticky lg:top-20 lg:flex">
                <TicketDetailTimeline
                  entries={auditEntries}
                  defaultOpen
                  createdAt={ticket.created_at}
                  updatedAt={ticket.updated_at}
                />
              </aside>
            </div>
          </div>
        </TripledDashboardShell>

        <TicketDetailPrimaryActions {...primaryActionProps} placement="mobile-sticky" />
      </TicketCollectProvider>
    </>
  );
}
