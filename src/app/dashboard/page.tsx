import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card';
import { getDashboardMetrics } from '@/actions/dashboard';
import { auth } from '@/lib/auth';
import { FormattedCurrency } from '@/components/formatted-currency';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Ticket, Users, DollarSign, Wrench, ShoppingCart } from 'lucide-react';
import { redirect } from 'next/navigation';
import {
  TripledMetricCard,
  TripledMotionDiv,
  tripledStagger,
  TripledPageHeader,
} from '@/components/tripled';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function DashboardPage() {
  const session = await auth();

  console.log('Full session:', JSON.stringify(session, null, 2));
  console.log('User:', session?.user);
  console.log('Company ID:', session?.user?.company_id);

  if (!session?.user?.company_id) {
    console.error('No company ID found in session');
    redirect('/login');
  }

  const metrics = await getDashboardMetrics(session.user.company_id);
  console.log('Dashboard metrics:', metrics);

  return (
    <>
      <TripledPageHeader items={[{ label: 'Dashboard' }]} />
      <div className="flex flex-1 flex-col gap-6 p-6">
        <TripledMotionDiv
          className="grid gap-4 md:grid-cols-2 lg:grid-cols-4"
          variants={tripledStagger}
          initial="hidden"
          animate="visible"
        >
          <TripledMetricCard
            title="Total de Tickets"
            icon={<Ticket className="h-4 w-4 text-muted-foreground" />}
            value={metrics.totalTickets}
          />
          <TripledMetricCard
            title="Ingresos Totales"
            icon={<DollarSign className="h-4 w-4 text-muted-foreground" />}
            value={<FormattedCurrency amount={metrics.totalRevenue} />}
          />
          <TripledMetricCard
            title="Total de Clientes"
            icon={<Users className="h-4 w-4 text-muted-foreground" />}
            value={metrics.totalClients}
          />
          <TripledMetricCard
            title="Total de Servicios"
            icon={<Wrench className="h-4 w-4 text-muted-foreground" />}
            value={metrics.totalServices}
          />
        </TripledMotionDiv>
        <Card>
          <CardHeader>
            <CardTitle>Servicios Vendidos</CardTitle>
            <CardDescription>
              Número total de servicios vendidos en todos los tickets
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5 text-muted-foreground" />
              <span className="text-2xl font-bold">
                {metrics.totalServicesSold}
              </span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Métricas de Clientes</CardTitle>
            <CardDescription>
              Resumen de actividad y gastos de clientes
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre del Cliente</TableHead>
                  <TableHead className="text-right">Tickets</TableHead>
                  <TableHead className="text-right">Total Gastado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {metrics.clientMetrics.map((client) => (
                  <TableRow key={client.id}>
                    <TableCell className="font-medium">{client.name}</TableCell>
                    <TableCell className="text-right">
                      {client.ticketCount}
                    </TableCell>
                    <TableCell className="text-right">
                      <FormattedCurrency amount={client.totalSpent} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
