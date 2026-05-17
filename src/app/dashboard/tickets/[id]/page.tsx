import { getTicketById } from '@/actions/tickets';
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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Mail, Phone, Calendar, Receipt } from 'lucide-react';
import Link from 'next/link';
import { FormattedDate } from '@/components/formatted-date';
import { FormattedCurrency } from '@/components/formatted-currency';
import { notFound } from 'next/navigation';
import { PDFDownloadButton } from '@/components/pdf-download-button';
import {
  buildInvoiceDataFromTicketDetail,
  buildTicketPdfFileName,
} from '@/lib/ticket-pdf-data';
import { TicketPaymentCollectSection } from '@/components/tickets/ticket-payment-collect-section';
import { requirePagePermission } from '@/lib/page-authz';

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

  return (
    <>
      <header className="flex h-16 shrink-0 items-center gap-2 border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="flex min-w-0 items-center gap-2 px-4">
          <SidebarTrigger className="-ml-1 shrink-0" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <Breadcrumb className="min-w-0">
            <BreadcrumbList>
              <BreadcrumbItem className="hidden md:block">
                <BreadcrumbLink href="/dashboard/tickets">
                  Tickets
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden md:block" />
              <BreadcrumbItem>
                <BreadcrumbPage className="truncate">
                  Detalles del Ticket
                </BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
      </header>

      <div className="flex min-w-0 flex-1 flex-col gap-6 overflow-x-hidden p-4 sm:p-6">
        <div className="mx-auto w-full min-w-0 max-w-2xl">
          <Card className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-xl ring-1 ring-black/5 dark:ring-white/10">
            <CardHeader className="space-y-6 border-b border-border/50 bg-gradient-to-br from-muted/40 via-background to-background px-5 pb-6 pt-7 sm:px-8 sm:pb-7 sm:pt-8">
              <div className="flex min-w-0 flex-col gap-5 lg:flex-row lg:items-start lg:justify-between lg:gap-8">
                <div className="min-w-0 space-y-2">
                  <CardTitle className="text-balance text-2xl font-semibold tracking-tight">
                    Información del Cliente
                  </CardTitle>
                  <CardDescription className="text-base text-muted-foreground">
                    Detalles del ticket{' '}
                    <span className="font-mono font-medium text-foreground tabular-nums">
                      #{ticket.id}
                    </span>
                  </CardDescription>
                </div>
                {ticket.finished && (
                  <div className="flex w-full min-w-0 shrink-0 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end lg:w-auto">
                    <Badge
                      variant="secondary"
                      className="w-fit shrink-0 border-transparent bg-emerald-100 px-3 py-1 text-emerald-900 hover:bg-emerald-100 dark:bg-emerald-950/80 dark:text-emerald-100"
                    >
                      Finalizado
                    </Badge>
                    <PDFDownloadButton
                      invoiceData={buildInvoiceDataFromTicketDetail(ticket)}
                      downloadFileName={buildTicketPdfFileName(ticket)}
                    />
                  </div>
                )}
              </div>
            </CardHeader>

            <CardContent className="space-y-10 px-5 pb-8 pt-8 sm:px-8">
              <section
                aria-labelledby="contact-heading"
                className="space-y-5 rounded-2xl border border-border/60 bg-muted/25 p-5 shadow-inner sm:p-6"
              >
                <div className="flex items-center gap-2">
                  <div className="h-1 w-8 rounded-full bg-gradient-to-r from-blue-500 to-purple-500" />
                  <h2
                    id="contact-heading"
                    className="text-sm font-semibold uppercase tracking-wider text-muted-foreground"
                  >
                    Datos de contacto
                  </h2>
                </div>

                <div className="grid gap-5">
                  <div className="space-y-2">
                    <label
                      htmlFor="ticket-client-name"
                      className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
                    >
                      Nombre del cliente o empresa
                    </label>
                    <div
                      id="ticket-client-name"
                      className="flex min-h-11 items-center rounded-xl border border-border/80 bg-background px-3.5 py-2.5 shadow-sm"
                    >
                      <span className="min-w-0 flex-1 truncate text-sm font-medium leading-snug">
                        {ticket.client_name}
                      </span>
                    </div>
                  </div>

                  <div className="grid min-w-0 gap-5 sm:grid-cols-2">
                    <div className="min-w-0 space-y-2">
                      <label
                        htmlFor="ticket-client-phone"
                        className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
                      >
                        Número de teléfono
                      </label>
                      <div
                        id="ticket-client-phone"
                        className="flex min-h-11 items-center gap-3 rounded-xl border border-border/80 bg-background px-3.5 py-2.5 shadow-sm"
                      >
                        <Phone
                          className="h-4 w-4 shrink-0 text-muted-foreground"
                          aria-hidden
                        />
                        <span className="min-w-0 flex-1 truncate text-sm font-medium tabular-nums">
                          {ticket.client_tel}
                        </span>
                      </div>
                    </div>

                    <div className="min-w-0 space-y-2">
                      <label
                        htmlFor="ticket-client-email"
                        className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
                      >
                        Correo electrónico
                      </label>
                      <div
                        id="ticket-client-email"
                        className="flex min-h-11 items-start gap-3 rounded-xl border border-border/80 bg-background px-3.5 py-2.5 shadow-sm sm:items-center"
                      >
                        <Mail
                          className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground sm:mt-0"
                          aria-hidden
                        />
                        <span className="min-w-0 flex-1 break-all text-sm font-medium leading-snug">
                          {ticket.email || 'No especificado'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label
                      htmlFor="ticket-created"
                      className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
                    >
                      Fecha de creación
                    </label>
                    <div
                      id="ticket-created"
                      className="flex min-h-11 items-center gap-3 rounded-xl border border-border/80 bg-background px-3.5 py-2.5 shadow-sm"
                    >
                      <Calendar
                        className="h-4 w-4 shrink-0 text-muted-foreground"
                        aria-hidden
                      />
                      <span className="text-sm font-medium">
                        <FormattedDate date={ticket.ticket_date} />
                      </span>
                    </div>
                  </div>
                </div>
              </section>

              <Separator className="bg-border/60" />

              <section aria-labelledby="services-heading" className="space-y-5">
                <div className="flex items-center gap-2">
                  <Receipt
                    className="h-5 w-5 text-muted-foreground"
                    aria-hidden
                  />
                  <h2
                    id="services-heading"
                    className="text-lg font-semibold tracking-tight"
                  >
                    Servicios
                  </h2>
                </div>

                <div className="overflow-hidden rounded-2xl border border-border/60 bg-background shadow-sm">
                  <ul className="divide-y divide-border/60">
                    {ticket.services_tickets.map((service) => (
                      <li key={service.id}>
                        <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
                          <div className="min-w-0 space-y-1">
                            <p className="font-medium leading-snug">
                              {service.service?.name ?? 'Servicio'}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              <span className="tabular-nums">
                                {service.quantity}
                              </span>{' '}
                              ×{' '}
                              <FormattedCurrency amount={service.price} /> / unidad
                            </p>
                          </div>
                          <p className="shrink-0 text-base font-semibold tabular-nums text-foreground">
                            <FormattedCurrency
                              amount={service.price * service.quantity}
                            />
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                  <div className="flex items-center justify-between gap-4 border-t border-border/60 bg-gradient-to-r from-muted/60 via-muted/40 to-muted/60 px-4 py-4 sm:px-5">
                    <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                      Total del ticket
                    </p>
                    <p className="text-xl font-bold tabular-nums tracking-tight">
                      <FormattedCurrency amount={ticket.total} />
                    </p>
                  </div>
                </div>
              </section>

              <TicketPaymentCollectSection
                ticketId={Number(ticket.id)}
                total={ticket.total}
                paid={ticket.paid}
                finished={ticket.finished}
                payments={ticket.ticket_payments ?? []}
              />

              {!ticket.finished && (
                <div className="pt-2">
                  <Link href={`/dashboard/tickets/${ticket.id}/edit`}>
                    <Button className="h-12 w-full rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 text-base font-semibold shadow-md transition-all hover:from-blue-700 hover:to-purple-700 hover:shadow-lg">
                      Editar Ticket
                    </Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
