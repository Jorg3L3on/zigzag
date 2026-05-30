'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { FormattedCurrency } from '@/components/formatted-currency';
import { Ticket, Users, DollarSign, Wrench, ShoppingCart } from 'lucide-react';
import {
  TripledMetricCard,
  TripledMotionDiv,
  tripledStagger,
} from '@/components/tripled';
import { DashboardCharts } from '@/components/dashboard/dashboard-charts';
import { useCompany } from '@/contexts/company-context';
import {
  fetchDashboardMetrics,
  type DashboardMetrics,
} from '@/actions/dashboard';
import type { DashboardMonthCount } from '@/lib/dashboard-metrics';
import { getErrorDisplayMessage } from '@/lib/network-awareness';

const MONTH_PRESETS: { value: DashboardMonthCount; label: string }[] = [
  { value: 3, label: '3 meses' },
  { value: 6, label: '6 meses' },
  { value: 12, label: '12 meses' },
];

const DashboardLoadingSkeleton = () => (
  <div className="flex flex-col gap-6">
    <div className="flex flex-wrap items-center justify-end gap-2">
      <Skeleton className="h-9 w-28" />
      <Skeleton className="h-9 w-28" />
      <Skeleton className="h-9 w-28" />
    </div>
    <div className="grid gap-5 sm:gap-4 md:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-28 rounded-xl" />
      ))}
    </div>
    <div className="grid gap-5 sm:gap-4 lg:grid-cols-2">
      <Skeleton className="h-[380px] rounded-xl" />
      <Skeleton className="h-[380px] rounded-xl" />
    </div>
    <Skeleton className="h-32 rounded-xl" />
    <Skeleton className="h-64 rounded-xl" />
  </div>
);

export const DashboardMetricsClient = () => {
  const router = useRouter();
  const { status, data: session } = useSession();
  const { selectedCompany } = useCompany();
  const [monthCount, setMonthCount] = React.useState<DashboardMonthCount>(12);
  const [metrics, setMetrics] = React.useState<DashboardMetrics | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (status === 'loading') {
      return;
    }
    if (!session?.user?.company_id) {
      router.replace('/login');
      return;
    }

    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      const isSystem = session.user.company_is_system;
      const companyIdArg =
        isSystem
          ? (selectedCompany?.id ?? session.user.company_id)
          : undefined;

      const res = await fetchDashboardMetrics({
        companyId: companyIdArg,
        monthCount,
      });

      if (cancelled) {
        return;
      }
      setLoading(false);
      if (!res.success || !res.data) {
        setError(
          getErrorDisplayMessage(
            res,
            'No se pudieron cargar las métricas',
            res.errorType,
          ),
        );
        return;
      }
      setError(null);
      setMetrics(res.data);
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [status, session, selectedCompany?.id, monthCount, router]);

  if (status === 'loading' || (loading && !metrics && !error)) {
    return <DashboardLoadingSkeleton />;
  }

  if (error && !metrics) {
    return (
      <p className="text-muted-foreground" role="alert">
        {error}
      </p>
    );
  }

  if (!metrics) {
    return null;
  }

  return (
    <div className="flex flex-col gap-5 sm:gap-6">
      {error && metrics ? (
        <p
          className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          role="alert"
        >
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center justify-end gap-2">
        <span className="mr-auto text-sm text-muted-foreground md:mr-0">
          Periodo de ingresos
        </span>
        {MONTH_PRESETS.map((p) => (
          <Button
            key={p.value}
            type="button"
            variant={monthCount === p.value ? 'default' : 'outline'}
            className="min-h-11 min-w-[5.5rem] rounded-xl sm:min-h-9"
            onClick={() => setMonthCount(p.value)}
            aria-pressed={monthCount === p.value}
            aria-label={`Mostrar ingresos de ${p.label}`}
          >
            {p.label}
          </Button>
        ))}
      </div>

      <TripledMotionDiv
        className="grid gap-5 sm:gap-4 md:grid-cols-2 lg:grid-cols-4"
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

      <div className={loading ? 'pointer-events-none opacity-60' : ''}>
        <DashboardCharts
          revenueByMonth={metrics.revenueByMonth}
          clientMetrics={metrics.clientMetrics}
          revenueMonthCount={monthCount}
        />
      </div>

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
      <Card id="dashboard-client-metrics">
        <CardHeader>
          <CardTitle>Métricas de Clientes</CardTitle>
          <CardDescription>
            Resumen de actividad y gastos de clientes
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-5 md:hidden">
            {metrics.clientMetrics.map((clientRow) => (
              <article
                key={clientRow.id}
                className="rounded-lg border border-border bg-card p-4"
              >
                <h3 className="truncate text-sm font-semibold text-foreground">
                  {clientRow.name}
                </h3>
                <dl className="mt-3 space-y-2 text-sm">
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
                    <dt className="text-muted-foreground">Tickets</dt>
                    <dd className="tabular-nums text-foreground">
                      {clientRow.ticketCount}
                    </dd>
                  </div>
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
                    <dt className="text-muted-foreground">Total gastado</dt>
                    <dd className="tabular-nums text-foreground">
                      <FormattedCurrency amount={clientRow.totalSpent} />
                    </dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>

          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre del Cliente</TableHead>
                  <TableHead className="text-right">Tickets</TableHead>
                  <TableHead className="text-right">Total Gastado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {metrics.clientMetrics.map((clientRow) => (
                  <TableRow key={clientRow.id}>
                    <TableCell className="font-medium">
                      {clientRow.name}
                    </TableCell>
                    <TableCell className="text-right">
                      {clientRow.ticketCount}
                    </TableCell>
                    <TableCell className="text-right">
                      <FormattedCurrency amount={clientRow.totalSpent} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
