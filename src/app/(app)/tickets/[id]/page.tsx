import { formatDocumentFolio, formatSourcePresupuestoFolio } from '@/lib/folio';
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
import { TicketDetailResendPrompt } from '@/components/tickets/detail/ticket-detail-resend-prompt';
import { TicketDetailQuickActions } from '@/components/tickets/detail/ticket-detail-quick-actions';
import { TicketDetailStatusPill } from '@/components/tickets/detail/ticket-detail-status-pill';
import { TicketDetailServicesSection } from '@/components/tickets/detail/ticket-detail-services-section';
import { TicketDetailPaymentsSection } from '@/components/tickets/detail/ticket-detail-payments-section';
import { TicketDetailCollectCard } from '@/components/tickets/detail/ticket-detail-collect-card';
import { TicketDetailClientCard } from '@/components/tickets/detail/ticket-detail-client-card';
import { TicketDetailActivityCard } from '@/components/tickets/detail/ticket-detail-activity-card';
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
  const folioLabel = formatDocumentFolio(ticket);
  const fromPresupuestoFolio = formatSourcePresupuestoFolio(ticket.source_presupuesto_folio);
  const total = ticket.total;
  const paid = ticket.paid;

  const documentProps = {
    ticketId: Number(ticket.id),
    folio: folioLabel,
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

  const materialCount = ticket.services_tickets.reduce(
    (sum, line) => sum + (line.materials?.length ?? 0),
    0,
  );
  const clientCard = (
    <TicketDetailClientCard
      client={
        ticket.client
          ? {
              id: ticket.client.id,
              name: ticket.client.name,
              email: ticket.client.email,
              phone: ticket.client.phone,
              address: ticket.client.address,
              street: ticket.client.street,
              exterior_number: ticket.client.exterior_number,
              neighborhood: ticket.client.neighborhood,
              city: ticket.client.city,
            }
          : null
      }
      clientName={ticket.client_name}
      clientTel={ticket.client_tel}
      clientEmail={ticket.email}
      ticketCount={ticket.client_ticket_count ?? null}
      ticketId={Number(ticket.id)}
      folio={folioLabel}
      total={total}
      paid={paid}
      finished={ticket.finished}
      companyName={ticket.company?.name ?? null}
    />
  );
  const moneyColumn = (
    <aside
      aria-label="Cobro del ticket"
      className="flex min-w-0 flex-col gap-4 lg:gap-6 @min-[60rem]:sticky @min-[60rem]:top-20 @min-[60rem]:col-start-2 @min-[60rem]:row-span-2 @min-[60rem]:row-start-1"
    >
      {ticket.finished ? (
        <>
          <div className="lg:hidden">
            <TicketDetailPaymentsSection payments={payments} />
          </div>
          <div className="hidden flex-col gap-4 lg:flex lg:gap-6">
            <TicketDetailCollectCard
              total={total}
              paid={paid}
              payments={payments}
              events={auditEntries.map((entry) => ({
                eventType: entry.eventType,
                createdAt: entry.createdAt,
                actorName: entry.actorName,
                payload: entry.payload,
              }))}
            />
            {clientCard}
            <TicketDetailActivityCard entries={auditEntries} />
          </div>
        </>
      ) : (
        <>
          <TicketDetailFinishPanel
            ticketId={ticket.id}
            clientId={ticket.client_id}
            clientName={ticket.client_name}
            total={total}
            ticketDate={ticket.ticket_date}
            serviceLines={serviceLines}
            lineCount={ticket.services_tickets.length}
            downloadFileName={downloadFileName}
            folio={folioLabel}
          />
          <div className="hidden flex-col gap-4 lg:flex lg:gap-6">
            {clientCard}
            <TicketDetailActivityCard entries={auditEntries} />
          </div>
        </>
      )}
    </aside>
  );

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
                  Ticket {folioLabel}
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
        folio={folioLabel}
        clientName={ticket.client_name}
        clientTel={ticket.client_tel}
        companyName={ticket.company?.name ?? null}
      >
        <TripledDashboardShell maxWidthClassName="max-w-[1200px]">
          <TripledMobileAppBar
            title={`Ticket ${folioLabel}`}
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

          {/* A container, not lg: the sidebar takes 256px, so at 1024 the page has ~720px.
              Two columns only from 60rem of page; narrower, the money side stacks under
              Servicios like on the phone (PR #610 review). */}
          <div className="@container flex flex-col gap-4 md:gap-6">
            <TicketDetailHeader
              ticketId={ticket.id}
              folio={folioLabel}
              fromPresupuestoFolio={fromPresupuestoFolio}
              clientName={ticket.client_name}
              clientId={ticket.client_id}
              finished={ticket.finished}
              total={total}
              paid={paid}
              ticketDate={ticket.ticket_date}
              creatorName={creatorName}
              fromPresupuestoId={fromPresupuestoId}
              serviceCount={ticket.services_tickets.length}
              materialCount={materialCount}
              actions={<TicketDetailPrimaryActions {...primaryActionProps} placement="desktop" />}
            />

            <TicketDetailHero
              finished={ticket.finished}
              total={total}
              paid={paid}
              className="lg:hidden"
            />

            <TicketDetailQuickActions
              {...documentProps}
              finished={ticket.finished}
              // Desktop has Cobrar / Compartir recibo and WhatsApp in the header (ZIG-I24).
              className="md:max-w-md lg:hidden"
            />

            {/* The right column is the money side (ZIG-I27-5): finish and collect while
                En proceso, Pagos once finished. Each section renders once and the DOM
                order is the phone order (finish panel above Servicios, Pagos between
                Servicios and Actividad); from lg the aside is placed in column 2 across
                both rows and stays sticky, and Actividad sits right under Servicios. */}
            <div className="grid gap-4 md:gap-6 @min-[60rem]:grid-cols-[minmax(0,1fr)_300px] @min-[60rem]:grid-rows-[auto_1fr] @min-[60rem]:items-start @min-[60rem]:gap-x-8 @min-[72rem]:grid-cols-[minmax(0,1fr)_340px]">
              {ticket.finished ? null : moneyColumn}

              <div className="min-w-0 @min-[60rem]:col-start-1 @min-[60rem]:row-start-1">
                <TicketDetailServicesSection
                  ticketId={ticket.id}
                  total={total}
                  paid={paid}
                  finished={ticket.finished}
                  workNotes={ticket.work_notes}
                  services={ticket.services_tickets}
                />
              </div>

              {ticket.finished ? moneyColumn : null}

              <div className="min-w-0 @min-[60rem]:col-start-1 @min-[60rem]:row-start-2">
                <TicketDetailTimeline
                  entries={auditEntries}
                  createdAt={ticket.created_at}
                  updatedAt={ticket.updated_at}
                />
              </div>
            </div>
          </div>
        </TripledDashboardShell>

        <TicketDetailPrimaryActions {...primaryActionProps} placement="mobile-sticky" />

        {ticket.finished ? (
          <TicketDetailResendPrompt
            ticketId={Number(ticket.id)}
            folio={folioLabel}
            clientName={ticket.client_name}
            clientTel={ticket.client_tel}
            total={total}
            paid={paid}
            downloadFileName={downloadFileName}
          />
        ) : null}
      </TicketCollectProvider>
    </>
  );
}
