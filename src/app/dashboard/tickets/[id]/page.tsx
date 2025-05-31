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
import { User, Mail, Phone, Calendar, Receipt } from 'lucide-react';
import Link from 'next/link';
import { FormattedDate } from '@/components/formatted-date';
import { FormattedCurrency } from '@/components/formatted-currency';
import { notFound } from 'next/navigation';
import { PDFDownloadButton } from '@/components/pdf-download-button';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function TicketDetailsPage({
  params,
}: {
  params: { id: string };
}) {
  const result = await getTicketById(Number(params.id));

  if (!result.success || !result.data) {
    notFound();
  }

  const ticket = result.data;

  return (
    <>
      <header className="flex h-16 shrink-0 items-center gap-2">
        <div className="flex items-center gap-2 px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem className="hidden md:block">
                <BreadcrumbLink href="/dashboard/tickets">
                  Tickets
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden md:block" />
              <BreadcrumbItem>
                <BreadcrumbPage>Detalles del Ticket</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
      </header>

      <div className="flex flex-1 flex-col gap-6 p-6">
        <div className="mx-auto w-full max-w-2xl">
          <Card className="border-0 shadow-lg">
            <CardHeader className="space-y-4 pb-8">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <CardTitle className="text-xl">
                    Información del Cliente
                  </CardTitle>
                  <CardDescription>
                    Detalles del ticket #{ticket.id}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  {ticket.finished && (
                    <>
                      <div className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
                        Finalizado
                      </div>
                      <PDFDownloadButton ticketId={Number(ticket.id)} />
                    </>
                  )}
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-600">
                    <User className="h-6 w-6 text-white" />
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-8">
              <div className="grid gap-6">
                <div className="space-y-3">
                  <label className="text-sm font-medium text-foreground">
                    Nombre del cliente o empresa
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <div className="h-12 pl-10 flex items-center border-2 rounded-md">
                      {ticket.client_name}
                    </div>
                  </div>
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-3">
                    <label className="text-sm font-medium text-foreground">
                      Número de teléfono
                    </label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <div className="h-12 pl-10 flex items-center border-2 rounded-md">
                        {ticket.client_tel}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <label className="text-sm font-medium text-foreground">
                      Correo electrónico
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <div className="h-12 pl-10 flex items-center border-2 rounded-md">
                        {ticket.email || 'No especificado'}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-sm font-medium text-foreground">
                    Fecha de creación
                  </label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <div className="h-12 pl-10 flex items-center border-2 rounded-md">
                      <FormattedDate date={ticket.ticket_date} />
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-sm font-medium text-foreground">
                    Servicios
                  </label>
                  <div className="relative">
                    <Receipt className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <div className="pl-10 space-y-2">
                      {ticket.services_tickets.map((service) => (
                        <div
                          key={service.id}
                          className="flex items-center justify-between p-3 border-2 rounded-md"
                        >
                          <div>
                            <p className="font-medium">
                              {service.service.name}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {service.quantity} x{' '}
                              <FormattedCurrency amount={service.price} />
                            </p>
                          </div>
                          <p className="font-medium">
                            <FormattedCurrency
                              amount={service.price * service.quantity}
                            />
                          </p>
                        </div>
                      ))}
                      <div className="flex items-center justify-between p-3 border-2 rounded-md bg-muted/50">
                        <p className="font-medium">Total</p>
                        <p className="font-medium">
                          <FormattedCurrency amount={ticket.total} />
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-4 pt-6">
                {!ticket.finished && (
                  <Link href={`/dashboard/tickets/${ticket.id}/edit`}>
                    <Button className="h-12 w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-medium transition-all duration-200 transform hover:scale-[1.02]">
                      Editar Ticket
                    </Button>
                  </Link>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
