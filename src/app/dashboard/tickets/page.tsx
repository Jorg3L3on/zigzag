import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { getTickets } from '@/actions/tickets';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from '@/components/ui/breadcrumb';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import Link from 'next/link';
import { FormattedDate } from '@/components/formatted-date';
import { FormattedCurrency } from '@/components/formatted-currency';
import {
  TicketRowActions,
  TicketDownloadButton,
} from '@/components/tickets/ticket-row-actions';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function TicketsPage() {
  const result = await getTickets();
  const tickets = result.success ? result.data : [];

  return (
    <>
      <header className="flex h-16 shrink-0 items-center gap-2">
        <div className="flex items-center gap-2 px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbPage>Tickets</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
      </header>

      <div className="flex flex-1 flex-col gap-6 p-6">
        <div className="mx-auto w-full">
          <Card className="border-0 shadow-lg">
            <CardHeader className="space-y-4 pb-8">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <CardTitle className="text-xl">Tickets</CardTitle>
                  <CardDescription>
                    Lista de todos los tickets registrados
                  </CardDescription>
                </div>
                <Link href="/dashboard/tickets/create">
                  <Button className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700">
                    <Plus className="mr-2 h-4 w-4" />
                    Nuevo Ticket
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead className="w-[50px]">PDF</TableHead>
                      <TableHead>Teléfono</TableHead>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead className="w-[100px]">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tickets?.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center">
                          No hay tickets registrados
                        </TableCell>
                      </TableRow>
                    ) : (
                      tickets?.map((ticket) => (
                        <TableRow key={ticket.id.toString()}>
                          <TableCell>{ticket.id}</TableCell>
                          <TableCell>{ticket.client_name}</TableCell>
                          <TableCell>
                            <TicketDownloadButton document={ticket.document} />
                          </TableCell>
                          <TableCell>{ticket.client_tel}</TableCell>
                          <TableCell>
                            <FormattedDate date={ticket.ticket_date} />
                          </TableCell>
                          <TableCell>
                            <FormattedCurrency amount={ticket.total} />
                          </TableCell>
                          <TableCell>
                            <TicketRowActions ticket={ticket} />
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
